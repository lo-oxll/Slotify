import * as rut from "@firebase/rules-unit-testing";
import { test, before, after } from "node:test";
import fs from "node:fs";
const { initializeTestEnvironment, assertFails, assertSucceeds } = rut;

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "waqti-test",
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await d.doc("users/biz1").set({ role: "business", name: "b", phone: "+966500000000" });
    await d.doc("users/c1").set({ role: "client", name: "c", phone: "+966511111111" });
    await d.doc("bookings/b1").set({ clientId: "c1", businessId: "biz1", status: "pending" });
    await d.doc("bookings/b1/contact/info").set({ phone: "+966511111111" });
  });
});
after(() => env.cleanup());

const as = (uid, claims) => env.authenticatedContext(uid, claims).firestore();

test("العميل لا يكتب الحجز مباشرة", () =>
  assertFails(as("c1").doc("bookings/x").set({ clientId: "c1", businessId: "biz1", status: "pending" })));
test("العميل لا يكتب busy", () => assertFails(as("c1").doc("busy/x").set({ a: 1 })));
test("غريب لا يقرأ الحجز", () => assertFails(as("other").doc("bookings/b1").get()));
test("العميل يقرأ حجزه ورقمه", async () => {
  await assertSucceeds(as("c1").doc("bookings/b1").get());
  await assertSucceeds(as("c1").doc("bookings/b1/contact/info").get());
});
test("النشاط لا يرى رقم العميل قبل القبول", () => assertFails(as("biz1").doc("bookings/b1/contact/info").get()));
test("النشاط يرى الرقم بعد القبول", async () => {
  await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc("bookings/b1").update({ status: "confirmed" }));
  await assertSucceeds(as("biz1").doc("bookings/b1/contact/info").get());
});
test("نشاط غير موثّق البريد لا يضيف خدمة", () =>
  assertFails(as("biz1", { email_verified: false }).doc("services/s1").set({ businessId: "biz1", name: "x" })));
test("نشاط موثّق يضيف خدمة", () =>
  assertSucceeds(as("biz1", { email_verified: true }).doc("services/s1").set({ businessId: "biz1", name: "x" })));
test("العميل لا يضيف خدمة", () =>
  assertFails(as("c1", { email_verified: true }).doc("services/s2").set({ businessId: "c1", name: "x" })));
