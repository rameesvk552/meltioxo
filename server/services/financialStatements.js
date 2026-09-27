// Monetary aggregation is performed in integer cents. Accounts keep their
// normal-side balance, while debit/credit columns show the actual posting side.
const cents = value => Math.round(Number(value || 0) * 100);
const money = value => value / 100;
const debitNormal = type => ['asset', 'expense'].includes(type);

function trialBalance(lines) {
  const accounts = new Map();
  for (const line of lines) {
    if (!line.account) continue;
    const a = line.account;
    const row = accounts.get(a.id) || { id: a.id, code: a.code, name: a.name, type: a.type, parent_id: a.parent_id, net: 0 };
    row.net += cents(line.debit) - cents(line.credit);
    accounts.set(a.id, row);
  }
  return [...accounts.values()].filter(row => row.net !== 0).map(({ net, ...row }) => ({
    ...row, balance: money(debitNormal(row.type) ? net : -net),
    debit: money(Math.max(net, 0)), credit: money(Math.max(-net, 0))
  })).sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
}

function balanceSheet(rows) {
  const groups = { asset: [], liability: [], equity: [] };
  let earnings = 0;
  for (const row of rows) {
    if (groups[row.type]) groups[row.type].push(row);
    else if (row.type === 'revenue') earnings += cents(row.balance);
    else if (row.type === 'expense') earnings -= cents(row.balance);
  }
  // Revenue/expense balances already transferred by closing journals are zero,
  // so this includes only earnings not yet transferred to an equity ledger.
  if (earnings) groups.equity.push({ id: 'unclosed-earnings', code: 'RESULT', name: 'Unclosed profit / loss', type: 'equity', balance: money(earnings), synthetic: true });
  const sum = items => money(items.reduce((total, row) => total + cents(row.balance), 0));
  const assets = sum(groups.asset), liabilities = sum(groups.liability), equity = sum(groups.equity);
  const difference = money(cents(assets) - cents(liabilities) - cents(equity));
  return { assets, liabilities, equity, unclosed_earnings: money(earnings), difference, balanced: difference === 0,
    sections: groups, accounts: [...groups.asset, ...groups.liability, ...groups.equity] };
}

function ledgerStatement(lines, type, from, to) {
  let opening = 0, running = 0, debits = 0, credits = 0;
  const sorted = [...lines].sort((a, b) => String(a.journalEntry.entry_date).localeCompare(String(b.journalEntry.entry_date))
    || String(a.journalEntry.created_at || '').localeCompare(String(b.journalEntry.created_at || ''))
    || String(a.id).localeCompare(String(b.id)));
  const rows = [];
  for (const line of sorted) {
    const date = String(line.journalEntry.entry_date).slice(0, 10);
    if (to && date > to) continue;
    const net = (cents(line.debit) - cents(line.credit)) * (debitNormal(type) ? 1 : -1);
    running += net;
    if (from && date < from) { opening += net; continue; }
    debits += cents(line.debit); credits += cents(line.credit);
    rows.push({ id: line.id, journal_id: line.journalEntry.id, date, reference: line.journalEntry.entry_number,
      source: line.journalEntry.reference_type, reference_id: line.journalEntry.reference_id,
      description: line.description || line.journalEntry.narration, debit: Number(line.debit), credit: Number(line.credit), balance: money(running) });
  }
  return { opening_balance: money(opening), closing_balance: money(running), total_debit: money(debits), total_credit: money(credits), rows };
}

function cashMovements(lines, from, to) {
  let opening = 0;
  const entries = new Map();
  for (const line of lines) {
    const j = line.journalEntry;
    const date = String(j.entry_date).slice(0,10);
    if (to && date > to) continue;
    const debit = cents(line.debit), credit = cents(line.credit);
    if (from && date < from) { opening += debit-credit; continue; }
    const row = entries.get(j.id) || { id: j.id, date, reference: j.entry_number, type: j.reference_type, description: j.narration, debit: 0, credit: 0, accounts: new Set() };
    row.debit += debit; row.credit += credit; row.accounts.add(line.account?.name || 'Cash / bank');
    entries.set(j.id, row);
  }
  let inflow = 0, outflow = 0, transfers = 0;
  const data = [...entries.values()].map(({ debit, credit, accounts, ...row }) => {
    const net = debit-credit;
    inflow += Math.max(net,0); outflow += Math.max(-net,0); transfers += Math.min(debit,credit);
    return { ...row, account: [...accounts].join(' · '), inflow: money(Math.max(net,0)), outflow: money(Math.max(-net,0)), transfer: money(Math.min(debit,credit)) };
  }).sort((a,b)=>b.date.localeCompare(a.date)||b.reference.localeCompare(a.reference));
  return { data, summary: { inflow: money(inflow), outflow: money(outflow), net: money(inflow-outflow), transfers: money(transfers), opening_balance: money(opening), closing_balance: money(opening+inflow-outflow) } };
}

module.exports = { cents, trialBalance, balanceSheet, ledgerStatement, cashMovements };
