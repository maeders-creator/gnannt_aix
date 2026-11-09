import test from 'node:test'
import assert from 'node:assert/strict'
import {groupProducts,matchingPrices,priceLabel,hasPrice} from '../src/wuerthProducts.mjs'
test('prices match normalized supplier article exactly, never material number or fuzzy numbers',()=>{
 const product={article_number:'001 AB'}
 const good={supplierArticle:'0 01ab',price:0,priceUnit:'100',quantity:'10',currency:'EUR',unit:'ST'}
 assert.deepEqual(matchingPrices(product,[good,{supplierArticle:'1AB',price:5},{supplierArticle:'001-AB',price:5},{materialNumber:'001AB',price:5}]),[good])
 assert.deepEqual(matchingPrices({article_number:''},[{supplierArticle:''}]),[])
 assert.equal(priceLabel(good),'0 EUR je 100 ST')
})
test('missing prices are unknown, not zero; preserve basis, currency and all duplicate lines',()=>{
 for(const price of [null,undefined,'',NaN,-1]){assert.equal(hasPrice({price}),false);assert.equal(priceLabel({price}),'Noch kein OCI-Preis')}
 const items=[{supplierArticle:'001',price:'1,20',currency:'EUR',priceUnit:100,quantity:10,unit:'ST'},{supplierArticle:'001',price:2,currency:'EUR',priceUnit:1,quantity:50,unit:'ST'}]
 assert.deepEqual(matchingPrices({article_number:'001'},items),items)
 assert.equal(priceLabel(items[0]),'1,20 EUR je 100 ST');assert.match(priceLabel({price:0}),/Währung unbekannt/)
})
test('groups and searches are derived from supplied products, including leading zeros',()=>{
 const products=[{article_number:'001 AB',description:'Schraube',product_group:'Befestigung'},{article_number:'002',description:'Dichtung',product_group:'Dichtstoffe'}]
 assert.equal(groupProducts(products).length,2)
 assert.equal(groupProducts(products,'001ab')[0][1][0],products[0])
 assert.equal(groupProducts(products,'dicht')[0][1][0],products[1])
 assert.equal(groupProducts(products,'','Dichtstoffe').length,1)
 assert.equal(groupProducts(products,'absent').length,0)
})
