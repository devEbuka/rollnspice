import { formatPrice } from "../format.js";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export function orderEmailContent(order) {
  const lines = order.order_items.map((item) => ({
    name: item.products?.name || "Menu item",
    quantity: item.quantity,
    total: formatPrice(item.unit_price * item.quantity),
    unit: formatPrice(item.unit_price),
  }));
  const instructions = order.special_instructions || "None";
  const total = formatPrice(order.subtotal);
  return {
    subject: `Roll N Spice order confirmation — ${order.id}`,
    text: ["Thank you for your order!", `Order reference: ${order.id}`, "",
      ...lines.map((line) => `${line.quantity} × ${line.name} (${line.unit} each): ${line.total}`),
      "", `Total: ${total}`, `Special instructions: ${instructions}`].join("\n"),
    html: `<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;color:#222;line-height:1.5;max-width:600px;margin:24px auto;padding:16px">
      <h1 style="font-size:24px">Thank you for your order!</h1>
      <p>Order reference: <strong>${escapeHtml(order.id)}</strong></p>
      <table style="width:100%;border-collapse:collapse"><thead><tr><th scope="col" style="text-align:left">Item</th><th scope="col">Qty</th><th scope="col" style="text-align:right">Amount</th></tr></thead><tbody>
      ${lines.map((line) => `<tr><td style="padding:12px 0;border-bottom:1px solid #ddd">${escapeHtml(line.name)}<br><small>${escapeHtml(line.unit)} each</small></td><td style="text-align:center">${line.quantity}</td><td style="text-align:right">${escapeHtml(line.total)}</td></tr>`).join("")}
      </tbody></table><p><strong>Total: ${escapeHtml(total)}</strong></p>
      <h2 style="font-size:18px">Special instructions</h2><p style="white-space:pre-wrap">${escapeHtml(instructions)}</p>
      <p>Roll N Spice</p></body></html>`,
  };
}
