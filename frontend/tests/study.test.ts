import test from 'node:test';
import assert from 'node:assert/strict';
import { pickStudyItem, randomInt, remainingSeconds, type StudyItem } from '../features/study/domain.ts';
const items:StudyItem[]=[{id:'a',title:'日语',enabled:true,sortOrder:0,createdAt:'',updatedAt:''},{id:'b',title:'网络',enabled:true,sortOrder:1,createdAt:'',updatedAt:''},{id:'c',title:'停用',enabled:false,sortOrder:2,createdAt:'',updatedAt:''}];
test('study random excludes disabled items and immediate previous item',()=>{assert.equal(pickStudyItem(items,'a',()=>0).id,'b');assert.equal(pickStudyItem([items[0]],'a',()=>.9).id,'a');assert.equal(randomInt(25,50,()=>0),25);assert.equal(randomInt(25,50,()=>.999),50);});
test('timer remaining time is timestamp based',()=>{assert.equal(remainingSeconds('2026-01-01T00:01:00.000Z',Date.parse('2026-01-01T00:00:30.100Z')),30);assert.equal(remainingSeconds('2026-01-01T00:00:00.000Z',Date.parse('2026-01-01T00:01:00.000Z')),0);});
