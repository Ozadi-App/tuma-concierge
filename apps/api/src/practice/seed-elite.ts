import { db, type DbStatement } from "../db/client.js";
import { runSeed } from "./batch.js";
import { PRACTICE_CUSTOMERS } from "./personas.js";

/**
 * Merchant Elite for the practice world's biggest store (Lakeside Fresh Mart): collections, discounts, a second outlet with
 * its own stock and a transfer, wholesale draft orders, counter sales, loyalty, suppliers and purchase orders, bundles,
 * win-back campaigns, SMS receipts, digital products with fulfilments and course sync. Also a laundry order on each of two
 * Work laundry jobs, using the laundry price list that ships with the platform.
 */
const STORE = "pe_lakeside_mart";
const when = (offset: string) => `datetime('now', '${offset}')`;
const customers = PRACTICE_CUSTOMERS;

export async function seedElite(): Promise<void> {
  const s: DbStatement[] = [];
  const category = String((await db.execute("SELECT category_id FROM merchant_outlets WHERE id = 'prac_out_1'")).rows[0]?.category_id ?? "");

  // A second outlet, so stock can be counted and moved between two.
  if (category) {
    s.push({ sql: "INSERT OR IGNORE INTO merchant_outlets (id, merchant_id, category_id, name, code, phone, address, lat, lng) VALUES ('prac_out_lm2', 'prac_m_pe_lakeside_mart', ?, 'Lakeside Fresh Mart, Kitoro branch', 'PEEBEE-PRAC-LM2', '0000004100', 'Kitoro, Entebbe', 0.0558, 32.4692)", args: [category] });
    for (const [n, qty] of [[1, 40], [2, 25], [3, 60], [4, 8]] as const) {
      s.push({ sql: "INSERT OR IGNORE INTO store_outlet_inventory (id, store_id, product_id, outlet_id, quantity, low_stock_threshold) VALUES (?, ?, ?, 'prac_out_1', ?, 10)", args: [`prac_oi_a${n}`, STORE, `pe_lm_${n}`, qty] });
      s.push({ sql: "INSERT OR IGNORE INTO store_outlet_inventory (id, store_id, product_id, outlet_id, quantity, low_stock_threshold) VALUES (?, ?, ?, 'prac_out_lm2', ?, 10)", args: [`prac_oi_b${n}`, STORE, `pe_lm_${n}`, Math.round(qty / 2)] });
    }
    s.push({ sql: "INSERT OR IGNORE INTO store_stock_transfers (id, store_id, product_id, from_outlet_id, to_outlet_id, quantity, note, status, created_by) VALUES ('prac_st_1', ?, 'pe_lm_3', 'prac_out_1', 'prac_out_lm2', 12, 'Weekend rush at Kitoro', 'completed', 'prac_mu_pe_lakeside_mart')", args: [STORE] });
  }

  s.push({ sql: "INSERT OR IGNORE INTO store_collections (id, store_id, title, slug, description, kind, pinned, sort_order, status) VALUES ('prac_col_1', ?, 'Fresh this week', 'fresh-this-week', 'Picked or baked in the last two days.', 'manual', 1, 1, 'active')", args: [STORE] });
  s.push({ sql: "INSERT OR IGNORE INTO store_collections (id, store_id, title, slug, description, kind, rule_field, rule_value, sort_order, status) VALUES ('prac_col_2', ?, 'Under UGX 5,000', 'under-5000', 'Small prices, big basket.', 'smart', 'price_lte', '5000', 2, 'active')", args: [STORE] });
  s.push({ sql: "INSERT OR IGNORE INTO store_discounts (id, store_id, code, title, kind, value, min_order_amount, max_uses, uses_count, is_automatic, expires_at, status) VALUES ('prac_dc_1', ?, 'WELCOME10', 'Welcome, 10% off', 'percent', 10, 20000, 200, 14, 0, " + when("+30 days") + ", 'active')", args: [STORE] });
  s.push({ sql: "INSERT OR IGNORE INTO store_discounts (id, store_id, code, title, kind, value, min_order_amount, uses_count, is_automatic, status) VALUES ('prac_dc_2', ?, 'FREEDEL', 'Free delivery over UGX 40,000', 'free_delivery', 0, 40000, 31, 1, 'active')", args: [STORE] });

  // Wholesale and counter sales.
  const items = (list: Array<[string, number, number]>) => JSON.stringify(list.map(([id, qty, price]) => ({ productId: id, title: id, quantity: qty, price })));
  s.push({ sql: "INSERT OR IGNORE INTO store_draft_orders (id, store_id, customer_name, customer_phone, customer_company, items_json, subtotal_amount, discount_amount, total_amount, payment_terms, notes, status) VALUES ('prac_do_1', ?, 'Rose Nakimuli', '0000004201', 'Lakeview Hotel', ?, 480000, 24000, 456000, 'net_14', 'Weekly vegetables for the hotel kitchen', 'sent')", args: [STORE, items([["pe_lm_1", 40, 6000], ["pe_lm_2", 60, 4000]])] });
  s.push({ sql: "INSERT OR IGNORE INTO store_draft_orders (id, store_id, customer_name, customer_phone, customer_company, items_json, subtotal_amount, discount_amount, total_amount, payment_terms, status) VALUES ('prac_do_2', ?, 'Moses Ddungu', '0000004202', 'Ddungu Canteen', ?, 150000, 0, 150000, 'immediate', 'paid')", args: [STORE, items([["pe_lm_3", 30, 5000]])] });
  customers.slice(0, 3).forEach((c, i) => s.push({
    sql: "INSERT OR IGNORE INTO store_pos_sales (id, store_id, outlet_id, cashier_user_id, customer_phone, customer_name, items_json, subtotal_amount, discount_amount, loyalty_redeemed_ugx, loyalty_earned_ugx, total_amount, payment_method, receipt_code, created_at) VALUES (?, ?, 'prac_out_1', 'prac_mu_pe_lakeside_mart', ?, ?, ?, ?, 0, 0, ?, ?, 'cash', ?, " + when(`-${i + 1} hours`) + ")",
    args: [`prac_pos_${i}`, STORE, c.phone, c.name, items([["pe_lm_1", 2, 6000], ["pe_lm_4", 1, 4500]]), 16_500 + i * 2_000, 330 + i * 40, 16_500 + i * 2_000, `RCP-PRAC-POS${i}`],
  }));
  customers.slice(0, 4).forEach((c, i) => s.push({
    sql: "INSERT OR IGNORE INTO store_customer_loyalty (id, store_id, customer_phone, customer_name, points_balance_ugx, total_earned_ugx, total_redeemed_ugx, orders_count, total_spent_ugx, tier, last_order_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, " + when(`-${i * 9} days`) + ")",
    args: [`prac_loy_${i}`, STORE, c.phone, c.name, 1_200 + i * 800, 2_400 + i * 1_500, 1_200 + i * 700, 4 + i * 5, 90_000 + i * 140_000, ["standard", "repeat", "vip", "vip"][i]!],
  }));

  // Suppliers and what is on order.
  s.push({ sql: "INSERT OR IGNORE INTO store_suppliers (id, store_id, name, contact_person, phone, email, address) VALUES ('prac_sup_1', ?, 'Mpigi Farmers Co-op', 'Jane Nambi', '0000004301', 'coop@practice.invalid', 'Mpigi')", args: [STORE] });
  s.push({ sql: "INSERT OR IGNORE INTO store_suppliers (id, store_id, name, contact_person, phone, address) VALUES ('prac_sup_2', ?, 'Kampala Dairy Wholesale', 'Peter Ssali', '0000004302', 'Nakawa, Kampala')", args: [STORE] });
  s.push({ sql: "INSERT OR IGNORE INTO store_purchase_orders (id, store_id, supplier_id, outlet_id, po_number, items_json, total_cost_ugx, status, ordered_at, notes, created_by) VALUES ('prac_po_1', ?, 'prac_sup_1', 'prac_out_1', 'PO-PRAC-0001', ?, 600000, 'ordered', " + when("-1 days") + ", 'Delivery Thursday', 'prac_mu_pe_lakeside_mart')", args: [STORE, items([["pe_lm_1", 100, 6000]])] });
  s.push({ sql: "INSERT OR IGNORE INTO store_purchase_orders (id, store_id, supplier_id, outlet_id, po_number, items_json, total_cost_ugx, status, ordered_at, received_at, created_by) VALUES ('prac_po_2', ?, 'prac_sup_2', 'prac_out_1', 'PO-PRAC-0002', ?, 320000, 'received', " + when("-8 days") + ", " + when("-6 days") + ", 'prac_mu_pe_lakeside_mart')", args: [STORE, items([["pe_lm_4", 80, 4000]])] });

  s.push({ sql: "INSERT OR IGNORE INTO store_bundles (id, store_id, title, description, price, compare_at_price, items_json, status) VALUES ('prac_bun_s1', ?, 'Family breakfast box', 'Bread, eggs and milk for the week.', 28000, 33000, ?, 'active')", args: [STORE, items([["pe_lm_1", 1, 6000], ["pe_lm_2", 1, 4000], ["pe_lm_4", 2, 4500]])] });
  customers.slice(3, 5).forEach((c, i) => s.push({
    sql: "INSERT OR IGNORE INTO store_winback_campaigns (id, store_id, customer_phone, customer_name, discount_code, channel, message, status, sent_at) VALUES (?, ?, ?, ?, 'WELCOME10', 'sms', ?, ?, " + when(i ? "-6 days" : "-2 days") + ")",
    args: [`prac_wb_${i}`, STORE, c.phone, c.name, `We miss you, ${c.name.split(" ")[0]}. Here is 10% off your next basket.`, i ? "converted" : "sent"],
  }));
  customers.slice(0, 3).forEach((c, i) => s.push({
    sql: "INSERT OR IGNORE INTO store_sms_logs (id, store_id, recipient_phone, recipient_name, message_type, body, status, cost_ugx, created_at) VALUES (?, ?, ?, ?, ?, ?, 'sent', 35, " + when(`-${i + 1} hours`) + ")",
    args: [`prac_sms_${i}`, STORE, c.phone, c.name, ["receipt", "receipt", "order_update"][i]!, ["Thanks for shopping at Lakeside Fresh Mart. Receipt RCP-PRAC-POS0.", "Thanks for shopping at Lakeside Fresh Mart. Receipt RCP-PRAC-POS1.", "Your order is on its way."][i]!],
  }));

  // Digital products: a download, a licence key, and a course that enrols the buyer in Peebee Learn.
  const course = "prac_crs_paid_1";
  [["prac_dp_1", "Home gardening guide (PDF)", "ebook", 12_000, null], ["prac_dp_2", "Bookkeeping templates (licence)", "software", 25_000, null], ["prac_dp_3", "Start a Small Business in Uganda", "course", 45_000, course]].forEach(([id, title, kind, price, linked]) => s.push({
    sql: "INSERT OR IGNORE INTO store_digital_products (id, store_id, title, kind, description, price_ugx, file_name, mime_type, max_downloads, expiry_days, linked_course_id, status, downloads_count, sales_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5, 30, ?, 'active', 7, 4)",
    args: [id as string, STORE, title as string, kind as string, `${title}: practice product.`, price as number, kind === "course" ? null : `${String(id)}.pdf`, kind === "course" ? null : "application/pdf", (linked as string | null) ?? null],
  }));
  customers.slice(0, 3).forEach((c, i) => s.push({
    sql: "INSERT OR IGNORE INTO store_digital_fulfillments (id, store_id, digital_product_id, customer_name, customer_phone, access_token, license_key_issued, download_count, max_downloads, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5, " + when("+25 days") + ", 'active')",
    args: [`prac_df_${i}`, STORE, ["prac_dp_1", "prac_dp_2", "prac_dp_3"][i]!, c.name, c.phone, `prac-access-${i}`, i === 1 ? "PRAC-KEY-4F2A-91C0" : null, i],
  }));
  customers.slice(2, 4).forEach((c, i) => s.push({
    sql: "INSERT OR IGNORE INTO store_lms_enrollments (id, store_id, course_id, student_name, student_phone, progress_percent, completed_lessons, total_lessons, quiz_average_score, certificate_issued, enrolled_at, last_active_at, access_status) VALUES (?, ?, ?, ?, ?, ?, ?, 3, ?, 0, " + when("-5 days") + ", " + when("-1 days") + ", 'active')",
    args: [`prac_lms_${i}`, STORE, course, c.name, c.phone, 33 + i * 34, 1 + i, 78 + i * 6],
  }));

  // Laundry: priced orders on two of the Work laundry jobs, from the price list that ships with the platform.
  const pkg = (await db.execute("SELECT id, name, price_ugx FROM laundry_packages WHERE active = 1 ORDER BY sort_order LIMIT 1")).rows[0];
  const item = (await db.execute("SELECT id, name, wash_price_ugx FROM laundry_items WHERE active = 1 ORDER BY sort_order LIMIT 2")).rows;
  if (pkg) {
    s.push({ sql: "INSERT OR IGNORE INTO laundry_orders (job_id, mode, pricing_mode, catalogue_total_ugx, goods_ugx, tip_kind, tip_ugx, frequency, detergent, contactless, notes, weighed_lb) VALUES ('prac_wj_2', 'package', 'fixed', ?, ?, 'free', 2000, 'one_time', 'Fragrance-free', 1, 'Leave at the gate', 11)", args: [Number(pkg.price_ugx), Number(pkg.price_ugx)] });
    s.push({ sql: "INSERT OR IGNORE INTO laundry_order_lines (id, job_id, kind, ref_id, name, treatment, count, unit_price_ugx, line_total_ugx) VALUES ('prac_ll_1', 'prac_wj_2', 'package', ?, ?, 'wash_fold', 1, ?, ?)", args: [String(pkg.id), String(pkg.name), Number(pkg.price_ugx), Number(pkg.price_ugx)] });
  }
  if (item.length) {
    const total = item.reduce((sum, r, i) => sum + Number(r.wash_price_ugx) * (i + 2), 0);
    s.push({ sql: "INSERT OR IGNORE INTO laundry_orders (job_id, mode, pricing_mode, catalogue_total_ugx, goods_ugx, tip_kind, frequency, notes) VALUES ('prac_wj_5', 'custom', 'fixed', ?, ?, 'none', 'weekly', 'Pick up every Monday')", args: [total, total] });
    item.forEach((r, i) => s.push({ sql: "INSERT OR IGNORE INTO laundry_order_lines (id, job_id, kind, ref_id, name, treatment, count, unit_price_ugx, line_total_ugx) VALUES (?, 'prac_wj_5', 'item', ?, ?, 'wash', ?, ?, ?)", args: [`prac_ll_i${i}`, String(r.id), String(r.name), i + 2, Number(r.wash_price_ugx), Number(r.wash_price_ugx) * (i + 2)] }));
  }

  await runSeed(s);
}
