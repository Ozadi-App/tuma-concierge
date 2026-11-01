import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { patchSchema } from "./patch-schema.js";

test("publishing or renaming must not reset an omitted price, stock or settings", () => {
  const create = z.object({ title: z.string().min(1), price: z.number().min(0).default(0), stock: z.number().int().default(10), settings: z.object({enabled:z.boolean().default(true)}).prefault({}) });
  const patch = patchSchema(create).extend({status:z.enum(["draft","published"]).optional()});
  assert.deepEqual(patch.parse({status:"published"}),{status:"published"});
  assert.deepEqual(patch.parse({title:"New name"}),{title:"New name"});
  assert.deepEqual(patch.parse({price:0,stock:0,settings:{}}),{price:0,stock:0,settings:{enabled:true}});
  assert.equal(patch.safeParse({price:-1}).success,false);
  assert.equal(patch.safeParse({title:42}).success,false);
  assert.deepEqual(create.parse({title:"Created"}),{title:"Created",price:0,stock:10,settings:{enabled:true}});
});
