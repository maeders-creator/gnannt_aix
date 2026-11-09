import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { parseOciCart, buildCatalogLaunch, receiveCatalogReturn, hashState, WUERTH_OCI_ENDPOINT, MAX_BODY_BYTES } from '../src/integrations/wuerthOci.mjs'

const state = 'a'.repeat(43)
function body(overrides = {}, index = 1) {
  return new URLSearchParams(Object.entries({ DESCRIPTION:'Schraube', VENDORMAT:'DEMO-ARTICLE', QUANTITY:'2.5', UNIT:'ST', PRICE:'12.34', CURRENCY:'EUR', PRICEUNIT:'100', ...overrides }).map(([key,value])=>[`NEW_ITEM-${key}[${index}]`,value])).toString()
}
const rejects = (fn, code) => assert.throws(fn, e => e.code === code)
test('cart preserves customer-price precision, price basis and supplier reference; never ordered', () => {
  const cart = parseOciCart(body())
  assert.equal(cart.items[0].price, '12.34')
  assert.equal(cart.items[0].priceUnit, '100')
  assert.equal(cart.items[0].quantity, '2.5')
  assert.equal(cart.items[0].supplierArticle, 'DEMO-ARTICLE')
  assert.equal(cart.ordered, false)
  assert.equal(cart.priceSource, 'unverified_browser_return')
})
test('missing price is unknown, never a free price; zero price is preserved', () => {
  assert.equal(parseOciCart(body({PRICE:''})).items[0].price,null)
  assert.equal(parseOciCart(body({PRICE:'0'})).items[0].price,'0')
  assert.equal(parseOciCart(body({PRICEUNIT:''})).items[0].priceUnit,'1')
})
test('rejects duplicate fields, sparse indexes, invalid encodings and excessive body size', () => {
  rejects(()=>parseOciCart(body()+'&NEW_ITEM-PRICE%5B1%5D=1'),'DUPLICATE_FIELD')
  rejects(()=>parseOciCart(body({},2)),'NONCONTIGUOUS_ITEMS')
  rejects(()=>parseOciCart(body()+'&bad=%GG'),'INVALID_ENCODING')
  rejects(()=>parseOciCart('x'.repeat(MAX_BODY_BYTES+1)),'BODY_TOO_LARGE')
  rejects(()=>parseOciCart(body({},201)),'TOO_MANY_ITEMS')
})
test('rejects invalid decimal, quantities, currency and price units', () => {
  for (const price of ['-1','1,25','1e3','NaN','Infinity','1.0000']) rejects(()=>parseOciCart(body({PRICE:price})),'INVALID_NUMBER')
  for (const quantity of ['0','0.000','-2']) rejects(()=>parseOciCart(body({QUANTITY:quantity})),'INVALID_NUMBER')
  rejects(()=>parseOciCart(body({CURRENCY:''})),'INVALID_CURRENCY')
  rejects(()=>parseOciCart(body({PRICEUNIT:'0'})),'INVALID_PRICE_UNIT')
  rejects(()=>parseOciCart(body({UNIT:''})),'INVALID_UNIT')
})
test('drops untrusted URLs and metadata, preserves text as data, rejects secrets and non-simple items', () => {
  const cart = parseOciCart(body({DESCRIPTION:'<img src=x onerror=alert(1)>',EXT_PRODUCT_ID:'https://evil.invalid'}))
  assert.equal(cart.items[0].description,'<img src=x onerror=alert(1)>')
  assert.equal(JSON.stringify(cart).includes('evil.invalid'),false)
  rejects(()=>parseOciCart(body()+'&PASSWORD=fake'),'UNEXPECTED_CREDENTIAL')
  rejects(()=>parseOciCart(body({ITEM_TYPE:'R'})),'UNSUPPORTED_ITEM_TYPE')
})
const launch = {
  configuration: { enabled:true, catalogOnlyConfirmed:true, credentialUseApproved:true, endpoint:WUERTH_OCI_ENDPOINT, callbackBase:'https://portal.example/oci/return' },
  credentials:{organization:'DEMO-ONLY',name:'DEMO-ONLY',password:'fake-test-password'},
  callbackUrl:'https://portal.example/oci/return/'+state,
}
test('disabled until separate live setup and no-order configuration are confirmed', () => {
  for (const flag of ['enabled','catalogOnlyConfirmed','credentialUseApproved']) rejects(()=>buildCatalogLaunch({...launch,configuration:{...launch.configuration,[flag]:false}}),'LIVE_SETUP_REQUIRED')
})
test('launch is POST to fixed Würth endpoint; credentials never placed in action URL', () => {
  const request = buildCatalogLaunch(launch)
  assert.equal(request.method,'POST')
  assert.equal(request.action,WUERTH_OCI_ENDPOINT)
  assert.equal(new URL(request.action).search,'')
  assert.equal(request.headers['Cache-Control'],'no-store')
  assert.deepEqual(Object.keys(request.fields),['ORGANIZATION','NAME','PASSWORD','HOOK_URL'])
})
test('rejects callback exfiltration, query strings, bad tokens and endpoint override', () => {
  rejects(()=>buildCatalogLaunch({...launch,configuration:{...launch.configuration,endpoint:'https://evil.invalid'}}),'UNAPPROVED_ENDPOINT')
  for (const callbackUrl of ['https://evil.invalid/oci/return/'+state,'https://portal.example/oci/returnevil/'+state]) rejects(()=>buildCatalogLaunch({...launch,callbackUrl}),'INVALID_CALLBACK')
  for (const callbackUrl of ['http://portal.example/oci/return/'+state,launch.callbackUrl+'?x=1']) rejects(()=>buildCatalogLaunch({...launch,callbackUrl}),'INVALID_URL')
})
async function fixture() {
  const stateHash = await hashState(state,webcrypto)
  const row={stateHash,expiresAt:1000,status:'pending',owner:'test-owner',project:'test-project'}
  const store={commitReturn:async ({stateHash,cart,now})=>{
    if(row.stateHash!==stateHash || row.status!=='pending' || now>=row.expiresAt) return false
    row.status='returned';row.cart=cart;return true
  }}
  const request={method:'POST',contentType:'application/x-www-form-urlencoded; charset=UTF-8',state,body:body(),store,now:500,cryptoApi:webcrypto}
  return {row,store,request}
}
test('return accepts once; repeats and simultaneous duplicates cannot overwrite preview',async()=>{
  const {row,request}=await fixture()
  const results=await Promise.allSettled([receiveCatalogReturn(request),receiveCatalogReturn(request)])
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1)
  assert.equal(row.cart.ordered,false)
  assert.equal(row.owner,'test-owner')
})
test('expired, wrong-state, wrong-method and wrong-content-type callbacks rejected',async()=>{
  const {request}=await fixture()
  for(const override of [{now:1000},{state:'b'.repeat(43)}]) await assert.rejects(receiveCatalogReturn({...request,...override}),e=>e.code==='SESSION_EXPIRED_OR_USED')
  await assert.rejects(receiveCatalogReturn({...request,method:'GET'}),e=>e.code==='METHOD_NOT_ALLOWED')
  await assert.rejects(receiveCatalogReturn({...request,contentType:'application/json'}),e=>e.code==='UNSUPPORTED_CONTENT_TYPE')
})
test('malformed return does not consume session; no supplier calls occur',async()=>{
  const {row,request}=await fixture()
  await assert.rejects(receiveCatalogReturn({...request,body:body({PRICE:'-1'})}))
  assert.equal(row.status,'pending')
  assert.equal((await receiveCatalogReturn(request)).ordered,false)
})

test('imports only allowlisted supplier raster image URLs and reports absence accurately',()=>{
 const image='https://media.wuerth.com/source/eshop/product.jpg'
 for(const field of ['ATTACHMENT','IMAGE','IMAGE_URL','EXT_IMAGE_URL']){
  const item=parseOciCart(body({[field]:image})).items[0]
  assert.equal(item.imageUrl,image);assert.equal(item.imageStatus,'available')
 }
 assert.equal(parseOciCart(body()).items[0].imageStatus,'not_supplied')
 assert.equal(parseOciCart(body({ATTACHMENT:image,ATTACHMENT_PURPOSE:'C'})).items[0].imageUrl,null)
})
test('unsupported image fields never break valid prices or retain unsafe URLs',()=>{
 for(const image of ['http://media.wuerth.com/product.jpg','https://evil.invalid/p.jpg','https://media.wuerth.com.evil.invalid/p.jpg','https://user:pass@media.wuerth.com/p.jpg','https://media.wuerth.com:444/p.jpg','https://media.wuerth.com/p.jpg?token=secret','https://media.wuerth.com/p.svg','https://media.wuerth.com/p.pdf','javascript:alert(1)','data:image/png;base64,abc','https://127.0.0.1/p.jpg','https://media.wuerth.com/a%2fb.jpg']){
  const item=parseOciCart(body({ATTACHMENT:image})).items[0]
  assert.equal(item.imageUrl,null);assert.equal(item.imageStatus,'unsupported');assert.equal(item.price,'12.34')
  assert.equal(JSON.stringify(item).includes(image),false)
 }
})
test('safe image fallback does not retain unsupported attachment or metadata',()=>{
 const cart=parseOciCart(body({ATTACHMENT:'https://evil.invalid/f.pdf',IMAGE_URL:'https://media.wuerth.com/product.png',ATTACHMENT_TITLE:'untrusted attachment title'}))
 assert.equal(cart.items[0].imageUrl,'https://media.wuerth.com/product.png')
 assert.equal(JSON.stringify(cart).includes('evil.invalid'),false)
 assert.equal(JSON.stringify(cart).includes('untrusted attachment'),false)
})
