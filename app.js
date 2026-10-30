// ===================== STATE =====================
let appData = { trips: [] };
let currentTrip = null;
let currentLedgerTab = "person";
let expandedCategoryName = null;

// Main Cashier sathi fix ID
const CASHIER_ID = "main_cashier";
const CASHIER_NAME = "Main Cashier";

let isLongPress = false;
let longPressTimer;

// ===================== LOAD DATA =====================
async function loadData() {
  const isCleared = sessionStorage.getItem("isCleared");
  const savedData = localStorage.getItem("tripHisabData");
  
  if (isCleared === "true") {
    appData = { trips: [] };
  } else if (savedData) {
    appData = JSON.parse(savedData);
  } else {
    try {
      const res = await fetch("data.json");
      appData = await res.json();
      saveData();
    } catch (e) {
      appData = { trips: [] };
    }
  }

  currentTrip = appData.trips[0] || null;
  if (currentTrip && !currentTrip.cashTransactions) {
    currentTrip.cashTransactions = []; 
  }
  init();
}

function saveData() {
  localStorage.setItem("tripHisabData", JSON.stringify(appData));
}

// ===================== INIT =====================
function init() {
  if (!currentTrip) {
    document.getElementById("summaryCard").innerHTML = `
      <h4 style="margin-bottom: 10px;">No trip found.</h4>
      <button class="btn-primary" onclick="openCreateTripModal()">+ Create New Trip</button>
    `;
    document.getElementById("expenseList").innerHTML = "";
    document.getElementById("ledgerContent").innerHTML = "";
    document.getElementById("settlementContent").innerHTML = "";
    return;
  }
  setupTabs();
  setupLedgerSwitch();
  renderDashboard();
  renderExpenseForm();
  renderLedger();
  renderSettlement();
  setupModals();
}

// ===================== TABS =====================
function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => {
        if(c.id !== 'personDetailPage') c.classList.remove("active");
      });
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

function setupLedgerSwitch() {
  document.querySelectorAll(".ledger-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ledger-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentLedgerTab = btn.dataset.ledger;
      expandedCategoryName = null;
      renderLedger();
    });
  });
}

// ===================== HELPERS =====================
function money(n) { return "₹" + Number(n).toFixed(2); }
function memberName(id) {
  if (id === CASHIER_ID) return CASHIER_NAME;
  if (!currentTrip || !currentTrip.members) return "Unknown";
  const member = currentTrip.members.find((m) => m.id === id);
  return member ? member.name : "Unknown";
}
function calculateShares(exp) {
  if (exp.customSplit) return exp.customSplit;
  const per = exp.amount / exp.splitAmongIds.length;
  const map = {};
  exp.splitAmongIds.forEach((id) => (map[id] = per));
  return map;
}

// Main Cashier cha hishob
function getMainCashierBalance() {
  const expenses = currentTrip.expenses || [];
  const txns = currentTrip.cashTransactions || [];
  
  let totalReceive = 0;
  let totalSpent = 0;

  txns.forEach(t => {
    if (t.type === 'receive') totalReceive += t.amount;
    else totalSpent += t.amount; 
  });

  expenses.forEach(e => {
    if (e.paidById === CASHIER_ID) totalSpent += e.amount;
  });

  const balance = totalReceive - totalSpent;
  return { totalReceive, totalSpent, balance };
}

// ===================== DASHBOARD =====================
function renderDashboard() {
  const expenses = currentTrip.expenses || [];
  let total = 0;
  expenses.forEach((e) => total += e.amount);
  
  const perPerson = currentTrip.members.length ? total / currentTrip.members.length : 0;
  const { balance } = getMainCashierBalance();

  document.getElementById("summaryCard").innerHTML = `
    <h4>${currentTrip.name}</h4>
    <div class="summary-row total"><span>Total Trip Expense</span><span>${money(total)}</span></div>
    <div class="summary-row"><span>Per Person Average</span><span>${money(perPerson)}</span></div>
    <div class="summary-row ${balance >= 0 ? "positive" : "negative"}">
      <span>Main Cashier Balance</span><span>${money(balance)}</span>
    </div>
  `;

  const list = document.getElementById("expenseList");
  list.innerHTML = expenses.length
    ? expenses.map((e) => `
      <div class="card" style="padding:10px;">
        <div class="expense-item">
          <div>
            <strong>${e.description}</strong><br/>
            <small>${e.category} • Paid by ${memberName(e.paidById)}</small>
          </div>
          <div class="amt">${money(e.amount)}</div>
        </div>
      </div>
    `).join("")
    : "<div class='card'>No expenses yet.</div>";
}

// ===================== EXPENSE FORM =====================
function renderExpenseForm() {
  const paidBy = document.getElementById("paidBy");
  
  let options = `<option value="${CASHIER_ID}" selected>${CASHIER_NAME} (Default)</option>`;
  options += currentTrip.members.map((m) => `<option value="${m.id}">${m.name}</option>`).join("");
  paidBy.innerHTML = options;

  const splitBox = document.getElementById("splitMembers");
  splitBox.innerHTML = currentTrip.members.map((m) => `
    <label>
      <input type="checkbox" value="${m.id}" checked />
      <span style="margin-left:6px;">${m.name}</span>
    </label>
  `).join("");

  document.getElementById("saveExpense").onclick = saveExpense;
}

function saveExpense() {
  const desc = document.getElementById("desc").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);
  const category = document.getElementById("category").value;
  const paidById = document.getElementById("paidBy").value;
  
  const splitAmongIds = Array.from(
    document.querySelectorAll("#splitMembers input:checked")
  ).map((i) => i.value);

  if (!desc || !amount || amount <= 0 || splitAmongIds.length === 0) {
    alert("Please fill all fields & select at least one member.");
    return;
  }

  currentTrip.expenses.push({
    id: "e" + Date.now(),
    description: desc,
    amount,
    category,
    paidById, 
    splitAmongIds,
    date: new Date().toISOString().slice(0, 10),
  });

  saveData();
  document.getElementById("desc").value = "";
  document.getElementById("amount").value = "";

  renderDashboard();
  renderLedger();
  renderSettlement();
  alert("Expense saved ✅");
  document.querySelector('.tab-btn[data-tab="dashboard"]').click();
}

// ===================== LEDGER MAIN =====================
function renderLedger() {
  const el = document.getElementById("ledgerContent");
  if (currentLedgerTab === "person") el.innerHTML = renderPersonLedger();
  else if (currentLedgerTab === "category") el.innerHTML = renderCategoryLedger();
  else el.innerHTML = renderCashierLedger();
  
  attachLedgerEvents();
}

// ---------- PERSON LEDGER ----------
function buildPersonLedger() {
  const map = {};
  currentTrip.members.forEach((m) => {
    map[m.id] = { id: m.id, name: m.name, paid: 0, share: 0, expenses: [] };
  });

  // १. प्रत्येकाने कॅशियरला किती पैसे जमा केले (Receive Entries)
  const txns = currentTrip.cashTransactions || [];
  txns.forEach(t => {
    if (t.type === 'receive' && map[t.memberId]) {
      map[t.memberId].paid += t.amount; 
    }
  });

  // २. प्रत्येकाने खर्च किती केला (Expenses)
  currentTrip.expenses.forEach((e) => {
    // जर खर्च मेंबरने केला असेल तर त्याच्या 'paid' मध्ये ॲड होईल
    if (map[e.paidById]) {
      map[e.paidById].paid += e.amount; 
    }
    // ३. प्रत्येकाचा खर्चातील वाटा (Split Share)
    const shares = calculateShares(e);
    Object.entries(shares).forEach(([id, amt]) => {
      if (map[id]) map[id].share += amt;
    });
  });

  return map;
}

function renderPersonLedger() {
  const ledger = buildPersonLedger();
  let html = `
    <div class="section-header">
      <h3>Members</h3>
      <button class="btn-sm" onclick="openAddPersonModal()">+ Add Person</button>
    </div>
    <div class="card">
  `;
  
  html += Object.values(ledger).map((p) => {
    const net = p.paid - p.share;
    let cls = "gray", label = "Settled";
    
    if (net > 0.01) { 
      cls = "green"; 
      label = "Available: " + money(net); 
    } 
    else if (net < -0.01) { 
      cls = "red"; 
      label = "उधार: " + money(-net); 
    } 

    return `
      <div class="ledger-row person-row" data-id="${p.id}" style="cursor: pointer;">
        <div>
          <div class="name">${p.name}</div>
          <div class="sub">Total Expense: ${money(p.share)} • Total Paid: ${money(p.paid)}</div>
        </div>
        <div class="amt ${cls}">${label}</div>
      </div>
      <div class="action-menu" id="menu-${p.id}" style="display:none;">
        <button class="outline" onclick="event.stopPropagation(); openEditPersonModal('${p.id}')">Edit</button>
        <button class="danger" onclick="event.stopPropagation(); deletePerson('${p.id}')">Delete</button>
      </div>
    `;
  }).join("");
  html += `</div>`;
  return html;
}

// ---------- PERSON DETAIL PAGE ----------
function openPersonDetail(personId) {
  history.pushState({ modal: true }, "", ""); 
  const person = currentTrip.members.find(m => m.id === personId);
  if (!person) return;
  
  const ledger = buildPersonLedger()[personId];
  const net = ledger.paid - ledger.share;
  const isOwed = net > 0.01;
  const isOwing = net < -0.01;

  const relatedExpenses = currentTrip.expenses.filter(e => 
    e.paidById === personId || e.splitAmongIds.includes(personId)
  );

  // १. सगळ्या एंट्रीजची एकूण बेरीज (Total Expense)
  let totalRelatedAmount = 0;
  relatedExpenses.forEach(e => totalRelatedAmount += e.amount);

  // २. त्या व्यक्तीचा एकूण वाटा (Your Split)
  let totalPersonShare = 0;
  relatedExpenses.forEach(e => {
    const shares = calculateShares(e);
    totalPersonShare += (shares[personId] || 0);
  });

  let html = `
    <div class="detail-header">
      <h2>${person.name}</h2>
      <div class="amt ${isOwed ? 'green' : (isOwing ? 'red' : 'gray')}">
        ${isOwed ? 'Available Balance: ' + money(net) : (isOwing ? 'उधार (Owes): ' + money(-net) : 'Settled')}
      </div>
      <div style="margin-top:10px; font-size:14px; color:#666;">
        <!-- ITHE EKUN BERIJ DAKHAVLI AHE -->
        Total Expense: <strong>${money(totalRelatedAmount)}</strong> | Your Split: <strong>${money(totalPersonShare)}</strong>
      </div>
    </div>
    <div class="card">
      <h4>All Expense Entries (${relatedExpenses.length})</h4>
  `;

  if (relatedExpenses.length === 0) {
    html += `<p>No expenses recorded for this person.</p>`;
  } else {
    html += relatedExpenses.map(e => {
      const shares = calculateShares(e);
      const myShare = shares[personId] || 0;
      const paidByMe = e.paidById === personId;
      const paidByName = memberName(e.paidById);

      return `
        <div class="ledger-row" style="flex-direction:column; align-items:flex-start; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
            <span class="name">${e.description} (${e.category})</span>
            <!-- ITHE TYA ENTRY CHA PERSON CHA VATA DAKHAVLA AHE -->
            <span class="amt" style="font-size:16px; font-weight:bold;">${money(myShare)}</span> 
          </div>
          <div class="sub" style="margin-top:4px;">
            Paid By: <strong>${paidByName} ${paidByMe ? '(Self)' : ''}</strong> <br/>
            Total ${e.category} Expense: <strong>${money(e.amount)}</strong>
          </div>
        </div>
      `;
    }).join("");
  }
  html += `</div>`;

  document.getElementById("personDetailContent").innerHTML = html;
  document.getElementById("personDetailPage").style.display = "block";
}
function closePersonDetail() {
  document.getElementById("personDetailPage").style.display = "none";
}

// ---------- CATEGORY LEDGER ----------
function renderCategoryLedger() {
  if (expandedCategoryName) return renderCategoryDetailView(expandedCategoryName);

  const map = {};
  let total = 0;
  currentTrip.expenses.forEach((e) => {
    total += e.amount;
    if (!map[e.category]) map[e.category] = { cat: e.category, total: 0, count: 0 };
    map[e.category].total += e.amount;
    map[e.category].count += 1;
  });

  let html = `
    <div class="section-header">
      <h3>Categories</h3>
      <button class="btn-sm" onclick="openAddCategoryModal()">+ Add Category</button>
    </div>
    <div class="card">
  `;

  if (Object.keys(map).length === 0) {
    html += `<p>No categories yet.</p>`;
  } else {
    html += Object.values(map).map((c) => {
      const pct = total ? (c.total / total) * 100 : 0;
      return `
        <div class="ledger-row category-row" data-cat="${c.cat}" style="flex-direction:column; align-items:flex-start; cursor:pointer;">
          <div style="display:flex; justify-content:space-between; width:100%;">
            <span class="name">${c.cat}</span>
            <span class="amt">${money(c.total)}</span>
          </div>
          <div class="sub">${c.count} entries • ${pct.toFixed(1)}%</div>
          <div class="progress-bar" style="width:100%;"><span style="width:${pct}%;"></span></div>
        </div>
        <div class="action-menu" id="menu-cat-${c.cat}" style="display:none;">
          <button class="outline" onclick="event.stopPropagation(); openEditCategoryModal('${c.cat}')">Edit Name</button>
          <button class="danger" onclick="event.stopPropagation(); deleteCategory('${c.cat}')">Delete</button>
        </div>
      `;
    }).join("");
  }
  html += `</div>`;
  return html;
}

function renderCategoryDetailView(categoryName) {
  const catExpenses = currentTrip.expenses.filter(e => e.category === categoryName);
  const total = catExpenses.reduce((s, e) => s + e.amount, 0);

  let html = `
    <button class="back-btn" onclick="closeCategoryDetail()">← Back to Categories</button>
    <div class="detail-header">
      <h2>${categoryName}</h2>
      <div class="amt" style="color: #4f46e5;">Total: ${money(total)}</div>
      <div style="margin-top:10px; font-size:14px; color:#666;">${catExpenses.length} Entries</div>
    </div>
    <div class="card">
      <h4>Transactions (Long press to Edit/Delete)</h4>
  `;

  if (catExpenses.length === 0) {
    html += `<p>No expenses in this category.</p>`;
  } else {
    html += catExpenses.map(e => `
      <div class="expense-row" data-id="${e.id}" style="cursor: pointer; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
        <div class="ledger-row" style="flex-direction:column; align-items:flex-start; border:none; padding:0; margin:0;">
          <div style="display:flex; justify-content:space-between; width:100%;">
            <span class="name">${e.description}</span>
            <span class="amt">${money(e.amount)}</span>
          </div>
          <div class="sub">Paid by ${memberName(e.paidById)} • ${e.date}</div>
        </div>
        <div class="action-menu" id="menu-exp-${e.id}" style="display:none;">
          <button class="outline" onclick="event.stopPropagation(); openEditExpenseModal('${e.id}')">Edit</button>
          <button class="danger" onclick="event.stopPropagation(); deleteExpense('${e.id}')">Delete</button>
        </div>
      </div>
    `).join("");
  }
  html += `</div>`;
  return html;
}

function closeCategoryDetail() {
  expandedCategoryName = null;
  renderLedger();
}

// ---------- MAIN CASHIER LEDGER ----------
function renderCashierLedger() {
  const { totalReceive, totalSpent, balance } = getMainCashierBalance();
  const txns = currentTrip.cashTransactions || [];
  const cashierExpenses = currentTrip.expenses.filter((e) => e.paidById === CASHIER_ID);

  let html = `
    <div class="section-header">
      <h3>Main Cashier Account</h3>
      <div style="display:flex; gap:5px;">
        <button class="btn-sm" style="background:#16a34a;" onclick="openCashModal('receive')">+ Receive (Jama)</button>
      </div>
    </div>

    <div class="card">
      <div class="summary-row"><span>Total Cash Received (Jama)</span><span class="green">+${money(totalReceive)}</span></div>
      <div class="summary-row"><span>Total Cash Spent (Expenses)</span><span class="red">-${money(totalSpent)}</span></div>
      <div class="summary-row positive" style="border-top:1px solid #ccc; padding-top:5px; margin-top:5px;">
        <span>Available Balance in Cashier</span><span>${money(balance)}</span>
      </div>
    </div>

    <div class="card">
      <h4>Cash Receive Entries (Jama)</h4>
      ${txns.length ? txns.map(t => {
        if (t.type === 'receive') {
          return `
          <div class="cash-txn-entry" data-id="${t.id}" data-type="cashTxn" style="cursor: pointer; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
            <div class="cash-txn-row" style="border:none; padding:0; margin:0;">
              <div>
                <strong>Received</strong> by ${memberName(t.memberId)}
                <div class="sub">${t.note || 'No note'} • ${t.date}</div>
              </div>
              <div class="amt-receive">+${money(t.amount)}</div>
            </div>
            <div class="action-menu" id="menu-cashtxn-${t.id}" style="display:none;">
              <button class="outline" onclick="event.stopPropagation(); openEditCashTxnModal('${t.id}')">Edit</button>
              <button class="danger" onclick="event.stopPropagation(); deleteCashTxn('${t.id}')">Delete</button>
            </div>
          </div>
        `}
        return "";
      }).join("") : "<p>No manual cash entries.</p>"}
    </div>

    <div class="card">
      <h4>Expenses Paid from Main Cashier (Long press to Edit/Delete)</h4>
      ${cashierExpenses.length ? cashierExpenses.map((e) => `
        <div class="cash-txn-entry" data-id="${e.id}" data-type="expense" style="cursor: pointer; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
          <div class="cash-txn-row" style="border:none; padding:0; margin:0;">
            <div>
              <strong>${e.description}</strong>
              <div class="sub">${e.category}</div>
            </div>
            <div class="amt-issue">-${money(e.amount)}</div>
          </div>
          <div class="action-menu" id="menu-cashexp-${e.id}" style="display:none;">
            <button class="outline" onclick="event.stopPropagation(); openEditExpenseModal('${e.id}')">Edit</button>
            <button class="danger" onclick="event.stopPropagation(); deleteExpense('${e.id}')">Delete</button>
          </div>
        </div>
      `).join("") : "<p>No cash expenses from cashier.</p>"}
    </div>
  `;
  return html;
}

// ===================== EVENT LISTENERS =====================
function attachLedgerEvents() {
  document.querySelectorAll(".person-row").forEach(row => {
    const id = row.dataset.id;
    row.addEventListener("click", () => { if (!isLongPress) openPersonDetail(id); });
    row.addEventListener("mousedown", () => startPress(id, "person"));
    row.addEventListener("mouseup", cancelPress);
    row.addEventListener("mouseleave", cancelPress);
    row.addEventListener("touchstart", () => startPress(id, "person"));
    row.addEventListener("touchend", cancelPress);
  });

  document.querySelectorAll(".category-row").forEach(row => {
    const cat = row.dataset.cat;
    row.addEventListener("click", () => { 
      if (!isLongPress) { 
        history.pushState({ modal: true }, "", ""); 
        expandedCategoryName = cat; 
        renderLedger(); 
      } 
    });
    row.addEventListener("mousedown", () => startPress(cat, "category"));
    row.addEventListener("mouseup", cancelPress);
    row.addEventListener("mouseleave", cancelPress);
    row.addEventListener("touchstart", () => startPress(cat, "category"));
    row.addEventListener("touchend", cancelPress);
  });

  document.querySelectorAll(".expense-row").forEach(row => {
    const id = row.dataset.id;
    row.addEventListener("mousedown", () => startExpensePress(id));
    row.addEventListener("mouseup", cancelPress);
    row.addEventListener("mouseleave", cancelPress);
    row.addEventListener("touchstart", () => startExpensePress(id));
    row.addEventListener("touchend", cancelPress);
  });

  document.querySelectorAll(".cash-txn-entry").forEach(row => {
    const id = row.dataset.id;
    const type = row.dataset.type;
    row.addEventListener("mousedown", () => startCashPress(id, type));
    row.addEventListener("mouseup", cancelPress);
    row.addEventListener("mouseleave", cancelPress);
    row.addEventListener("touchstart", () => startCashPress(id, type));
    row.addEventListener("touchend", cancelPress);
  });
}

function startPress(id, type) {
  isLongPress = false;
  longPressTimer = setTimeout(() => {
    isLongPress = true;
    if (type === "person") document.getElementById(`menu-${id}`).style.display = "flex";
    else document.getElementById(`menu-cat-${id}`).style.display = "flex";
  }, 600); 
}

function startExpensePress(id) {
  isLongPress = false;
  longPressTimer = setTimeout(() => {
    isLongPress = true;
    const menu = document.getElementById(`menu-exp-${id}`);
    if (menu) menu.style.display = "flex";
  }, 600); 
}

function startCashPress(id, type) {
  isLongPress = false;
  longPressTimer = setTimeout(() => {
    isLongPress = true;
    if (type === "cashTxn") {
      const menu = document.getElementById(`menu-cashtxn-${id}`);
      if (menu) menu.style.display = "flex";
    } else {
      const menu = document.getElementById(`menu-cashexp-${id}`);
      if (menu) menu.style.display = "flex";
    }
  }, 600); 
}

function cancelPress() {
  clearTimeout(longPressTimer);
  setTimeout(() => { isLongPress = false; }, 100); 
}

// ===================== MODALS & CRUD =====================
function setupModals() {
  if (!document.getElementById("modalOverlay")) {
    const div = document.createElement("div");
    div.id = "modalOverlay";
    div.className = "modal-overlay";
    div.innerHTML = `<div class="modal-box" id="modalBox"></div>`;
    document.body.appendChild(div);
    div.addEventListener("click", (e) => { if (e.target.id === "modalOverlay") closeModal(); });
  }
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("active");
  document.getElementById("modalBox").innerHTML = "";
}

function openAddPersonModal() {
  history.pushState({ modal: true }, "", "");
  document.getElementById("modalBox").innerHTML = `
    <h3>Add Person</h3>
    <label>Name <input type="text" id="mName" /></label>
    <button class="btn-primary" onclick="savePerson()">Save</button>
    <button class="btn-sm outline" style="width:100%; margin-top:5px;" onclick="closeModal()">Cancel</button>
  `;
  document.getElementById("modalOverlay").classList.add("active");
}

function openEditPersonModal(id) {
  history.pushState({ modal: true }, "", "");
  const p = currentTrip.members.find(m => m.id === id);
  document.getElementById("modalBox").innerHTML = `
    <h3>Edit Person</h3>
    <label>Name <input type="text" id="mName" value="${p.name}" /></label>
    <button class="btn-primary" onclick="savePerson('${id}')">Update</button>
    <button class="btn-sm outline" style="width:100%; margin-top:5px;" onclick="closeModal()">Cancel</button>
  `;
  document.getElementById("modalOverlay").classList.add("active");
}

function savePerson(id = null) {
  const name = document.getElementById("mName").value.trim();
  if (!name) return alert("Name required");
  if (id) {
    currentTrip.members.find(m => m.id === id).name = name;
  } else {
    currentTrip.members.push({ id: "m" + Date.now(), name });
  }
  saveData();
  closeModal();
  renderLedger();
  renderExpenseForm();
  renderDashboard();
  renderSettlement();
}

function deletePerson(id) {
  if (!confirm("Delete this person?")) return;
  currentTrip.members = currentTrip.members.filter(m => m.id !== id);
  currentTrip.expenses.forEach(e => {
    if (e.paidById === id) e.paidById = "unknown";
    e.splitAmongIds = e.splitAmongIds.filter(pid => pid !== id);
  });
  saveData();
  renderLedger();
  renderExpenseForm();
  renderDashboard();
  renderSettlement();
}

function openAddCategoryModal() {
  history.pushState({ modal: true }, "", "");
  document.getElementById("modalBox").innerHTML = `
    <h3>Add Category</h3>
    <label>Category Name <input type="text" id="catName" placeholder="e.g. Snacks" /></label>
    <button class="btn-primary" onclick="saveCategory()">Add</button>
    <button class="btn-sm outline" style="width:100%; margin-top:5px;" onclick="closeModal()">Cancel</button>
  `;
  document.getElementById("modalOverlay").classList.add("active");
}

function openEditCategoryModal(oldName) {
  history.pushState({ modal: true }, "", "");
  document.getElementById("modalBox").innerHTML = `
    <h3>Edit Category</h3>
    <p>Rename "${oldName}" to:</p>
    <label>New Name <input type="text" id="catName" value="${oldName}" /></label>
    <button class="btn-primary" onclick="saveCategory('${oldName}')">Update</button>
    <button class="btn-sm outline" style="width:100%; margin-top:5px;" onclick="closeModal()">Cancel</button>
  `;
  document.getElementById("modalOverlay").classList.add("active");
}

function saveCategory(oldName = null) {
  const newName = document.getElementById("catName").value.trim();
  if (!newName) return alert("Name required");
  if (oldName) {
    currentTrip.expenses.forEach(e => { if (e.category === oldName) e.category = newName; });
  }
  const catSelect = document.getElementById("category");
  if (!Array.from(catSelect.options).some(o => o.value === newName)) {
    const opt = document.createElement("option");
    opt.value = newName;
    opt.text = newName;
    catSelect.add(opt);
  }
  saveData();
  closeModal();
  renderLedger();
  renderDashboard();
  renderSettlement();
}

function deleteCategory(catName) {
  if (!confirm(`Delete category "${catName}"?`)) return;
  currentTrip.expenses.forEach(e => { if (e.category === catName) e.category = "Misc"; });
  saveData();
  renderLedger();
  renderDashboard();
  renderSettlement();
}

function openCashModal(type) {
  history.pushState({ modal: true }, "", "");
  const membersHtml = currentTrip.members.map(m => `<option value="${m.id}">${m.name}</option>`).join("");
  document.getElementById("modalBox").innerHTML = `
    <h3>Receive Cash (Jama)</h3>
    <label>Amount (₹) <input type="number" id="cAmount" /></label>
    <label>Kon det ahe? <select id="cMember">${membersHtml}</select></label>
    <label>Note <input type="text" id="cNote" placeholder="e.g. Trip sathi jama kele" /></label>
    <button class="btn-primary" onclick="saveCash('${type}')">Save</button>
    <button class="btn-sm outline" style="width:100%; margin-top:5px;" onclick="closeModal()">Cancel</button>
  `;
  document.getElementById("modalOverlay").classList.add("active");
}

function saveCash(type) {
  const amount = parseFloat(document.getElementById("cAmount").value);
  const memberId = document.getElementById("cMember").value;
  const note = document.getElementById("cNote").value;
  if (!amount || amount <= 0) return alert("Valid amount required");
  if (!currentTrip.cashTransactions) currentTrip.cashTransactions = [];
  currentTrip.cashTransactions.push({
    id: "c" + Date.now(), type, amount, memberId, note, date: new Date().toISOString().slice(0, 10)
  });
  saveData();
  closeModal();
  renderLedger();
  renderDashboard();
  renderSettlement();
}

// ---------- CASH TXN EDIT / DELETE ----------
function openEditCashTxnModal(id) {
  history.pushState({ modal: true }, "", "");
  const txn = currentTrip.cashTransactions.find(t => t.id === id);
  if (!txn) return;

  const membersHtml = currentTrip.members.map(m => 
    `<option value="${m.id}" ${m.id === txn.memberId ? 'selected' : ''}>${m.name}</option>`
  ).join("");

  document.getElementById("modalBox").innerHTML = `
    <h3>Edit Cash Transaction</h3>
    <label>Amount (₹) <input type="number" id="editCAmount" value="${txn.amount}" /></label>
    <label>Member <select id="editCMember">${membersHtml}</select></label>
    <label>Note <input type="text" id="editCNote" value="${txn.note || ''}" /></label>
    <button class="btn-primary" onclick="saveEditedCashTxn('${id}')">Update</button>
    <button class="btn-sm outline" style="width:100%; margin-top:5px;" onclick="closeModal()">Cancel</button>
  `;
  document.getElementById("modalOverlay").classList.add("active");
}

function saveEditedCashTxn(id) {
  const txn = currentTrip.cashTransactions.find(t => t.id === id);
  if (!txn) return;

  const amount = parseFloat(document.getElementById("editCAmount").value);
  const memberId = document.getElementById("editCMember").value;
  const note = document.getElementById("editCNote").value;

  if (!amount || amount <= 0) return alert("Valid amount required");

  txn.amount = amount;
  txn.memberId = memberId;
  txn.note = note;

  saveData();
  closeModal();
  renderLedger();
  renderDashboard();
  renderSettlement();
}

function deleteCashTxn(id) {
  if (!confirm("Delete this cash transaction?")) return;
  currentTrip.cashTransactions = currentTrip.cashTransactions.filter(t => t.id !== id);
  saveData();
  renderLedger();
  renderDashboard();
  renderSettlement();
}

// ---------- EXPENSE EDIT / DELETE ----------
function openEditExpenseModal(id) {
  history.pushState({ modal: true }, "", "");
  const exp = currentTrip.expenses.find(e => e.id === id);
  if (!exp) return;

  let options = `<option value="${CASHIER_ID}" ${exp.paidById === CASHIER_ID ? 'selected' : ''}>${CASHIER_NAME}</option>`;
  options += currentTrip.members.map(m => 
    `<option value="${m.id}" ${m.id === exp.paidById ? 'selected' : ''}>${m.name}</option>`
  ).join("");

  document.getElementById("modalBox").innerHTML = `
    <h3>Edit Expense</h3>
    <label>Description <input type="text" id="editDesc" value="${exp.description}" /></label>
    <label>Amount (₹) <input type="number" id="editAmount" value="${exp.amount}" /></label>
    <label>Category
      <select id="editCategory">
        <option ${exp.category === 'Food' ? 'selected' : ''}>Food</option>
        <option ${exp.category === 'Travel' ? 'selected' : ''}>Travel</option>
        <option ${exp.category === 'Stay' ? 'selected' : ''}>Stay</option>
        <option ${exp.category === 'Fuel' ? 'selected' : ''}>Fuel</option>
        <option ${exp.category === 'Shopping' ? 'selected' : ''}>Shopping</option>
        <option ${exp.category === 'Tickets' ? 'selected' : ''}>Tickets</option>
        <option ${exp.category === 'Misc' ? 'selected' : ''}>Misc</option>
      </select>
    </label>
    <label>Paid By
      <select id="editPaidBy">${options}</select>
    </label>
    <button class="btn-primary" onclick="saveEditedExpense('${id}')">Update Expense</button>
    <button class="btn-sm outline" style="width:100%; margin-top:5px;" onclick="closeModal()">Cancel</button>
  `;
  document.getElementById("modalOverlay").classList.add("active");
}

function saveEditedExpense(id) {
  const exp = currentTrip.expenses.find(e => e.id === id);
  if (!exp) return;

  const desc = document.getElementById("editDesc").value.trim();
  const amount = parseFloat(document.getElementById("editAmount").value);
  const category = document.getElementById("editCategory").value;
  const paidById = document.getElementById("editPaidBy").value;

  if (!desc || !amount || amount <= 0) {
    alert("Please fill valid details.");
    return;
  }

  exp.description = desc;
  exp.amount = amount;
  exp.category = category;
  exp.paidById = paidById;

  saveData();
  closeModal();
  
  renderLedger();
  renderDashboard();
  renderSettlement();
}

function deleteExpense(id) {
  if (!confirm("Delete this expense?")) return;
  currentTrip.expenses = currentTrip.expenses.filter(e => e.id !== id);
  saveData();
  renderLedger();
  renderDashboard();
  renderSettlement();
}

// ===================== SETTLEMENT =====================
function calculateSettlements() {
  const creditors = [], debtors = [];

  // १. प्रत्येक मेंबरने किती पैसे दिले (Jama + Kharch) आणि त्याचा वाटा किती (Share) ते काढू
  const memberStats = {};
  currentTrip.members.forEach(m => {
    memberStats[m.id] = { name: m.name, paid: 0, share: 0 };
  });

  // मेंबरने कॅशियरला दिलेले पैसे (Jama)
  const txns = currentTrip.cashTransactions || [];
  txns.forEach(t => {
    if (t.type === 'receive' && memberStats[t.memberId]) {
      memberStats[t.memberId].paid += t.amount;
    }
  });

  // खर्च आणि स्प्लिट
  currentTrip.expenses.forEach(e => {
    if (memberStats[e.paidById]) {
      memberStats[e.paidById].paid += e.amount;
    }
    const shares = calculateShares(e);
    Object.entries(shares).forEach(([id, amt]) => {
      if (memberStats[id]) memberStats[id].share += amt;
    });
  });

  // २. मेंबर्सचा Net Balance (Paid - Share)
  Object.values(memberStats).forEach(p => {
    const net = p.paid - p.share;
    if (net > 0.01) creditors.push({ name: p.name, amt: net });
    else if (net < -0.01) debtors.push({ name: p.name, amt: -net });
  });

  // ३. कॅशियरचा हिशोब
  const { balance } = getMainCashierBalance();
  if (balance > 0.01) {
    // कॅशियरकडे जास्त पैसे आहेत (त्याला परत मिळायचे आहेत)
    creditors.push({ name: CASHIER_NAME, amt: balance });
  } else if (balance < -0.01) {
    // कॅशियरकडे पैसे कमी आहेत (उदा. -420, म्हणजे कॅशियरला 420 द्यायचे आहेत)
    debtors.push({ name: CASHIER_NAME, amt: -balance });
  }

  // ४. आता कोण कुणाला देणार ते ठरवू
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const finalTxns = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i], c = creditors[j];
    const min = Math.min(d.amt, c.amt);
    
    if (min > 0.01) {
      finalTxns.push({ from: d.name, to: c.name, amount: min });
    }
    
    d.amt -= min; 
    c.amt -= min;
    
    if (d.amt < 0.01) i++;
    if (c.amt < 0.01) j++;
  }

  return finalTxns;
}

function renderSettlement() {
  const el = document.getElementById("settlementContent");
  const txns = calculateSettlements();
  let total = 0;
  currentTrip.expenses.forEach((e) => { total += e.amount; });
  const perPerson = currentTrip.members.length ? total / currentTrip.members.length : 0;
  
  const { balance } = getMainCashierBalance();

  el.innerHTML = `
    <div class="final-card">
      <h3>🏁 Trip Final Summary</h3>
      <div class="row"><span>Total Trip Expense</span><span>${money(total)}</span></div>
      <div class="row"><span>Per Person Average</span><span>${money(perPerson)}</span></div>
      <div class="row"><span>Cashier Balance</span><span>${money(balance)}</span></div>
      <div class="row highlight"><span>Amount Left / Balance</span><span>${money(balance)}</span></div>
    </div>
    <h3 style="margin-bottom:10px;">Who Owes Whom (कोण कोणाला देणार)</h3>
    ${txns.length ? txns.map((t) => `
      <div class="settlement-item">
        <span class="from">${t.from}</span> <span>➡️</span> <span class="to">${t.to}</span>
        <span class="amount">${money(t.amount)}</span>
      </div>
    `).join("") : `<div class="card"><p>✅ All settled. No pending transactions.</p></div>`}
  `;
}

// ===================== SETTINGS =====================
function openSettingsModal() { 
  history.pushState({ modal: true }, "", "");
  document.getElementById("settingsModal").classList.add("active"); 
}
function closeSettingsModal() { document.getElementById("settingsModal").classList.remove("active"); document.getElementById("restoreFile").value = ""; }

function backupData() {
  const dataStr = JSON.stringify(appData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trip_hisab_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function restoreData() {
  const file = document.getElementById("restoreFile").files[0];
  if (!file) return alert("Please select a .json backup file.");
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsedData = JSON.parse(e.target.result);
      if (!parsedData.trips) throw new Error("Invalid file format.");
      appData = parsedData;
      currentTrip = appData.trips[0] || null;
      if (currentTrip && !currentTrip.cashTransactions) currentTrip.cashTransactions = [];
      saveData();
      if (currentTrip) { init(); alert("✅ Data restored!"); } 
      else { alert("✅ Restored but no trips found."); location.reload(); }
      closeSettingsModal();
    } catch (err) { alert("❌ Restore failed: " + err.message); }
  };
  reader.readAsText(file);
}

function clearAllData() {
  const confirm1 = confirm("⚠️ WARNING: This will permanently delete all data. Are you sure?");
  if (!confirm1) return;
  const confirm2 = prompt("Type 'DELETE' to confirm:");
  if (confirm2 !== "DELETE") return alert("Clear data cancelled.");

  localStorage.removeItem("tripHisabData");
  sessionStorage.setItem("isCleared", "true"); 

  closeSettingsModal();
  alert("🗑️ All data cleared successfully.");
  
  location.reload(); 
}

// ===================== BACK SHORTCUT & MOBILE BACK HANDLING =====================
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") handleBackAction();
});

window.addEventListener("popstate", function (event) {
  handleBackAction();
  if (isModalOpen() || isDetailOpen()) {
    history.pushState({ modal: true }, "", "");
  }
});

function handleBackAction() {
  const modalOverlay = document.getElementById("modalOverlay");
  const settingsModal = document.getElementById("settingsModal");
  const personDetailPage = document.getElementById("personDetailPage");
  const createTripModal = document.getElementById("createTripModal");

  if (modalOverlay && modalOverlay.classList.contains("active")) { closeModal(); return; }
  if (settingsModal && settingsModal.classList.contains("active")) { closeSettingsModal(); return; }
  if (createTripModal && createTripModal.classList.contains("active")) { createTripModal.classList.remove("active"); return; }
  
  if (personDetailPage && personDetailPage.style.display === "block") { closePersonDetail(); return; }
  if (currentLedgerTab === "category" && expandedCategoryName !== null) { closeCategoryDetail(); return; }
}

function isModalOpen() {
  const m1 = document.getElementById("modalOverlay");
  const m2 = document.getElementById("settingsModal");
  const m3 = document.getElementById("createTripModal");
  return (m1 && m1.classList.contains("active")) || (m2 && m2.classList.contains("active")) || (m3 && m3.classList.contains("active"));
}

function isDetailOpen() {
  const p1 = document.getElementById("personDetailPage");
  return (p1 && p1.style.display === "block") || (currentLedgerTab === "category" && expandedCategoryName !== null);
}

// ===================== CREATE NEW TRIP LOGIC =====================
let tempMembers = [];

function openCreateTripModal() {
  history.pushState({ modal: true }, "", "");
  tempMembers = []; 
  document.getElementById("newTripName").value = "";
  document.getElementById("newMemberName").value = "";
  renderTempMembersList();
  document.getElementById("createTripModal").classList.add("active");
}

function renderTempMembersList() {
  const list = document.getElementById("newTripMembersList");
  list.innerHTML = tempMembers.map((m, i) => `
    <div style="display:flex; justify-content:space-between; background:#eee; padding:5px 10px; border-radius:5px;">
      <span>${m.name}</span>
      <button onclick="removeTempMember(${i})" style="background:none; border:none; color:red; cursor:pointer;">✖</button>
    </div>
  `).join("");
}

function addMemberToNewTrip() {
  const nameInput = document.getElementById("newMemberName");
  const name = nameInput.value.trim();
  if (name) {
    tempMembers.push({ id: "m" + Date.now() + Math.random(), name });
    nameInput.value = "";
    renderTempMembersList();
  }
}

function removeTempMember(index) {
  tempMembers.splice(index, 1);
  renderTempMembersList();
}

function createNewTrip() {
  const tripName = document.getElementById("newTripName").value.trim();
  
  if (!tripName) return alert("Please enter Trip Name");
  if (tempMembers.length === 0) return alert("Please add at least one member");

  const newTrip = {
    id: "trip-" + Date.now(),
    name: tripName,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    initialCashPool: 0, 
    members: tempMembers,
    expenses: [],
    cashTransactions: []
  };

  appData.trips.push(newTrip);
  currentTrip = newTrip;
  
  sessionStorage.removeItem("isCleared"); 
  saveData();
  
  document.getElementById("createTripModal").classList.remove("active");
  init(); 
}

// ===================== START =====================
loadData();

// ===================== ENTER KEY NAVIGATION (Next Input) =====================
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const activeEl = document.activeElement;
    
    // फक्त इनपुट आणि सेलेक्ट बॉक्सवर काम करा (बटणांवर नाही)
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
      e.preventDefault(); // फॉर्म सबमिट होण्यापासून रोखा

      // सध्याच्या मोडल/पेजमधील सगळे इनपुट आणि सेलेक्ट घ्या
      const container = activeEl.closest('.modal-box') || activeEl.closest('.tab-content') || document;
      const inputs = Array.from(container.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]), select'));
      
      const index = inputs.indexOf(activeEl);
      
      if (index > -1 && index < inputs.length - 1) {
        // पुढच्या इनपुटवर फोकस करा
        inputs[index + 1].focus();
      } else if (index === inputs.length - 1) {
        // जर शेवटचं इनपुट असेल तर 'Save' किंवा 'Create' बटणावर क्लिक करा
        const submitBtn = container.querySelector('.btn-primary');
        if (submitBtn) submitBtn.click();
      }
    }
  }
});