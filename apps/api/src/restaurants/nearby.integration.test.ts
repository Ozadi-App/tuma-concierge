import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {createClient,type InArgs} from '@libsql/client/node';
import {Hono} from 'hono';
import {signToken} from '../auth/jwt.js';
import {setD1Binding,type D1Database} from '../db/client.js';
import {splitSqlStatements} from '../db/split-sql.js';
import {resetSchemaCache} from '../lib/schema.js';
import {setPlatformEnvironment,setServiceSwitches} from '../lib/settings.js';
import {nearbyFoodRoutes,parseNearbyQuery,sortNearby,type NearbyItem} from './nearby.js';

test('parseNearbyQuery clamps radius, trims search and rejects bad coordinates',()=>{
  assert.deepEqual(parseNearbyQuery({lat:'0.3',lng:'32.5'}),{lat:0.3,lng:32.5,located:true,radiusKm:5,term:''});
  assert.equal(parseNearbyQuery({radiusKm:'100'}).radiusKm,25);
  assert.equal(parseNearbyQuery({radiusKm:'0'}).radiusKm,0.5);
  assert.equal(parseNearbyQuery({lat:'999',lng:'32'}).located,false);
  assert.equal(parseNearbyQuery({lat:'0.3'}).located,false);
  assert.equal(parseNearbyQuery({q:'  ROLEX '+'x'.repeat(100)}).term.length,60);
});

test('sortNearby puts featured first, then nearest',()=>{
  const mk=(id:string,f:boolean,d:number|null)=>({id,name:id,isFeatured:f,distanceKm:d}) as NearbyItem;
  assert.deepEqual(sortNearby([mk('a',false,1),mk('b',true,4),mk('c',false,0.5),mk('d',true,null)]).map(i=>i.id),['b','d','c','a']);
});

test('GET /food/nearby-items returns open dishes within the radius, respects environment, search and rate limit',async()=>{
  process.env.JWT_SECRET='food-nearby-tests-only';resetSchemaCache();
  const client=createClient({url:'file::memory:'});
  const migrations=join(process.cwd(),'src/db/migrations');
  for(const file of readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort())
    for(const sql of splitSqlStatements(readFileSync(join(migrations,file),'utf8'))) await client.execute(sql);
  const state=new WeakMap<object,{sql:string;args:InArgs}>();
  const prepare=(sql:string)=>{const data={sql,args:[] as InArgs};const st={bind(...a:unknown[]){data.args=a as InArgs;return st;},async all(){const r=await client.execute(data);return {results:r.rows,success:true,meta:{changes:r.rowsAffected}};}};state.set(st,data);return st;};
  setD1Binding({prepare,async batch(sts:Parameters<D1Database['batch']>[0]){const rs=await client.batch(sts.map(s=>state.get(s)!),'write');return rs.map(r=>({results:r.rows,success:true,meta:{changes:r.rowsAffected}}));}} as unknown as D1Database);
  await setPlatformEnvironment('live');await setServiceSwitches({food:true});
  await client.execute("INSERT INTO users(id,name,password_hash,role,email) VALUES('owner','O','h','customer','o@x.test'),('buyer','B','h','customer','b@x.test'),('spam','S','h','customer','s@x.test')");
  await client.execute(`INSERT INTO restaurants(id,owner_id,name,status,is_open,environment,lat,lng,business_type) VALUES
    ('near','owner','Near Kitchen','active',1,'live',0.31,32.58,'kitchen'),
    ('far','owner','Far Place','active',1,'live',0.45,32.6,'restaurant'),
    ('shut','owner','Closed Spot','active',0,'live',0.31,32.58,'restaurant'),
    ('sand','owner','Sandbox Spot','active',1,'sandbox',0.31,32.58,'restaurant'),
    ('pend','owner','Pending','pending_approval',1,'live',0.31,32.58,'restaurant')`);
  await client.execute("INSERT INTO menu_categories(id,restaurant_id,name) VALUES('c1','near','Local')");
  await client.execute(`INSERT INTO menu_items(id,restaurant_id,category_id,name,price,is_featured,prep_time_minutes,available) VALUES
    ('rolex','near','c1','Rolex',5000,0,10,1),('pilau','near','c1','Beef pilau',12000,1,25,1),('gone','near','c1','Hidden',1,0,5,0),
    ('farx','far',NULL,'Far dish',1,1,5,1),('shutx','shut',NULL,'Shut dish',1,1,5,1),('sandx','sand',NULL,'Sand dish',1,1,5,1),('pendx','pend',NULL,'Pend dish',1,1,5,1)`);
  await client.execute("INSERT INTO menu_item_options(id,menu_item_id,name,required) VALUES('o1','pilau','Size',1)");
  const buyer=await signToken({sub:'buyer',role:'customer'});
  const app=new Hono().route('/v1',nearbyFoodRoutes);
  const get=async(q:string,t=buyer)=>{const r=await app.request('/v1/food/nearby-items'+q,{headers:{Authorization:`Bearer ${t}`}});return {status:r.status,body:await r.json() as {items:NearbyItem[];located:boolean;radiusKm:number;paused?:boolean}};};
  const near=await get('?lat=0.3353&lng=32.5857&radiusKm=5');
  assert.equal(near.status,200);assert.equal(near.body.located,true);
  assert.deepEqual(near.body.items.map(i=>i.id),['pilau','rolex']);
  const pilau=near.body.items[0];
  assert.equal(pilau.isFeatured,true);assert.equal(pilau.from,true);assert.equal(pilau.prepTimeMinutes,25);assert.equal(pilau.businessType,'kitchen');
  assert.equal(pilau.restaurantName,'Near Kitchen');assert.equal(pilau.categoryName,'Local');assert.ok(pilau.distanceKm!>0&&pilau.distanceKm!<5);
  assert.deepEqual((await get('?lat=0.3353&lng=32.5857&q=rolex')).body.items.map(i=>i.id),['rolex']);
  assert.deepEqual((await get('?lat=0.3353&lng=32.5857&q=local')).body.items.length,2,'menu section matches too');
  const wide=await get('?lat=0.3353&lng=32.5857&radiusKm=25');assert.ok(wide.body.items.some(i=>i.id==='farx'));
  const anywhere=await get('');assert.equal(anywhere.body.located,false);
  assert.deepEqual(anywhere.body.items.map(i=>i.id).sort(),['farx','pilau','rolex']);assert.ok(anywhere.body.items.every(i=>i.distanceKm===null));
  await setPlatformEnvironment('sandbox');
  const sb=await get('');const sbNear=await get('?lat=0.0645&lng=32.4594');assert.ok(sbNear.body.items.length>0&&sbNear.body.items.every(i=>i.isDemo&&i.distanceKm===0));assert.ok(sb.body.items.some(i=>i.id==='sandx'));assert.ok(sb.body.items.some(i=>i.isDemo&&i.restaurantId.startsWith('demo-food-')));assert.ok(!sb.body.items.some(i=>i.id==='rolex'));
  await setPlatformEnvironment('live');
  await setServiceSwitches({food:false});assert.equal((await get('')).body.paused,true);await setServiceSwitches({food:true});
  assert.equal((await app.request('/v1/food/nearby-items')).status,401);
  const spam=await signToken({sub:'spam',role:'customer'});let last=0;for(let i=0;i<61;i++)last=(await get('',spam)).status;assert.equal(last,429);
});
