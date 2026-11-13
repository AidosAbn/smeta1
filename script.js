"use strict";

(() => {
  const positionsBody = document.getElementById("positions-body");
  const positionTemplate = document.getElementById("position-template");
  const addButton = document.getElementById("add-position");
  const grandTotal = document.getElementById("grand-total");
  const dateInput = document.getElementById("estimate-date");
  const discountInput = document.getElementById("discount-percent");
  const vatInput = document.getElementById("vat-percent");
  const currencyInput = document.getElementById("currency");
  const currencyNote = document.getElementById("currency-note");
  const subtotalOutput = document.getElementById("subtotal");
  const discountOutput = document.getElementById("discount-amount");
  const discountedOutput = document.getElementById("discounted-subtotal");
  const vatOutput = document.getElementById("vat-amount");
  const discountRow = document.getElementById("discount-row");
  const discountedRow = document.getElementById("discounted-row");
  const vatRow = document.getElementById("vat-row");
  const numberInput = document.getElementById("estimate-number");
  const printTitle = document.getElementById("print-title");
  const savePdfButton = document.getElementById("save-pdf");
  const newEstimateButton = document.getElementById("new-estimate");
  const copyButton = document.getElementById("copy-whatsapp");
  const copyStatus = document.getElementById("copy-status");
  const draftStatus = document.getElementById("draft-status");
  const manualCopy = document.getElementById("manual-copy");
  const shareText = document.getElementById("share-text");
  const draftKey = "smeta:draft:v1";
  const draftFields = [
    "sender", "recipient", "estimate-number", "estimate-date",
    "discount-percent", "vat-percent", "currency", "comment",
  ].map((id) => document.getElementById(id));
  const moneyFormatter = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const printNumberFormatter = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 20,
  });
  let nextPositionId = 0;
  let pauseDraftSaving = true;
  let copyTimer;
  let copyRequest = 0;

  function readNumber(value) {
    const normalized = value.trim().replace(/[ \u00a0\u202f]/g, "").replace(",", ".");

    // Проверяем всё значение: «15 000» допустимо, «15000abc» — нет.
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
      return 0;
    }

    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function roundMoney(value) {
    const amount = Math.round(value);
    return Number.isSafeInteger(amount) && amount !== 0 ? amount : 0;
  }

  function formatMoney(amount) {
    const formatted = moneyFormatter.format(roundMoney(amount)).replace(/[\u00a0\u202f]/g, " ");
    return `${formatted} ${currencyInput.value}`;
  }

  function formatNumber(value) {
    return printNumberFormatter.format(readNumber(value)).replace(/[\u00a0\u202f]/g, " ");
  }

  function setToday() {
    // Локальная дата браузера: UTC может указывать на предыдущий день.
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    dateInput.value = `${today.getFullYear()}-${month}-${day}`;
  }

  function saveDraft() {
    if (pauseDraftSaving) {
      return;
    }

    const draft = {
      version: 1,
      fields: Object.fromEntries(draftFields.map((field) => [field.id, field.value])),
      positions: Array.from(positionsBody.rows, (row) => Object.fromEntries(
        Array.from(row.querySelectorAll("[data-field]"), (field) => [field.dataset.field, field.value])
      )),
    };

    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      draftStatus.hidden = true;
    } catch {
      // Запрет хранения или переполненное хранилище не должны ломать расчёты.
      draftStatus.hidden = false;
    }
  }

  function setFieldValue(field, value) {
    if (typeof value !== "string") {
      return;
    }
    if (field.tagName === "SELECT" && !Array.from(field.options).some((option) => option.value === value)) {
      return;
    }
    field.value = value;
  }

  function restoreDraft() {
    let draft;
    try {
      draft = JSON.parse(localStorage.getItem(draftKey));
    } catch {
      return false;
    }

    if (!draft || draft.version !== 1 || !draft.fields || typeof draft.fields !== "object" || !Array.isArray(draft.positions)) {
      return false;
    }

    draftFields.forEach((field) => setFieldValue(field, draft.fields[field.id]));
    draft.positions.forEach((position) => {
      if (position && typeof position === "object" && !Array.isArray(position)) {
        addPosition(false, position);
      }
    });
    if (positionsBody.rows.length === 0) {
      addPosition(false);
    }
    return true;
  }

  function clearCopyFeedback() {
    clearTimeout(copyTimer);
    copyRequest += 1;
    copyStatus.textContent = "";
    manualCopy.hidden = true;
    shareText.value = "";
  }

  function recalculate() {
    let subtotal = 0;

    for (const row of positionsBody.rows) {
      const quantity = readNumber(row.querySelector('[data-field="quantity"]').value);
      const price = readNumber(row.querySelector('[data-field="price"]').value);
      const amount = roundMoney(quantity * price);
      row.querySelector(".line-total").textContent = formatMoney(amount);
      subtotal += amount;
    }

    // Каждый денежный шаг округляется до целых, чтобы строки итога сходились.
    subtotal = roundMoney(subtotal);
    const discount = roundMoney(subtotal * (readNumber(discountInput.value) / 100));
    const discountedSubtotal = roundMoney(subtotal - discount);
    const vat = roundMoney(discountedSubtotal * (readNumber(vatInput.value) / 100));

    subtotalOutput.textContent = formatMoney(subtotal);
    discountOutput.textContent = formatMoney(discount);
    discountedOutput.textContent = formatMoney(discountedSubtotal);
    vatOutput.textContent = formatMoney(vat);
    discountRow.hidden = discount === 0;
    discountedRow.hidden = discountedSubtotal === 0;
    vatRow.hidden = vat === 0;
    currencyNote.textContent = `Валюта: ${currencyInput.value}`;

    const formattedTotal = formatMoney(roundMoney(discountedSubtotal + vat));
    if (grandTotal.textContent !== formattedTotal) {
      grandTotal.textContent = formattedTotal;
    }
  }

  function updateRowLabels() {
    Array.from(positionsBody.rows).forEach((row, index) => {
      const number = index + 1;
      row.querySelectorAll(".item-number").forEach((label) => {
        label.textContent = ` позиции ${number}`;
      });
      row.querySelector(".line-total").setAttribute("aria-label", `Сумма позиции ${number}`);
      row.querySelector(".remove-button").setAttribute("aria-label", `Удалить позицию ${number}`);
    });
  }

  function formatPrintDate(value) {
    if (!value) {
      return "";
    }
    const [year, month, day] = value.split("-");
    return `${day}.${month}.${year}`;
  }

  function preparePrint() {
    recalculate();
    const number = numberInput.value.trim() || "____";
    const date = formatPrintDate(dateInput.value) || "____";
    printTitle.textContent = `Смета № ${number} от ${date}`;

    // Текстовые копии позволяют печатать длинные значения без обрезки полями.
    document.querySelectorAll(".details input, #positions-body input, #positions-body select, #comment").forEach((field) => {
      let printValue = field.nextElementSibling;
      if (!printValue || !printValue.classList.contains("print-value")) {
        printValue = document.createElement("span");
        printValue.className = "print-value print-only";
        field.after(printValue);
      }

      let value = field.value;
      if (field.type === "date") {
        value = formatPrintDate(value);
      } else if (field.dataset.field === "quantity" || field.dataset.field === "price") {
        value = formatNumber(value);
        if (field.dataset.field === "price") {
          value += ` ${currencyInput.value}`;
        }
      }
      printValue.textContent = value;
    });
  }

  function addPosition(focusName = true, values = {}) {
    const row = positionTemplate.content.firstElementChild.cloneNode(true);
    const positionId = ++nextPositionId;

    row.querySelectorAll("[data-field]").forEach((field) => {
      field.id = `position-${positionId}-${field.dataset.field}`;
      field.name = field.id;
      field.previousElementSibling.htmlFor = field.id;
      setFieldValue(field, values[field.dataset.field]);
    });

    positionsBody.append(row);
    updateRowLabels();
    recalculate();
    saveDraft();
    clearCopyFeedback();

    if (focusName) {
      row.querySelector('[data-field="name"]').focus();
    }
    return row;
  }

  function nextEstimateNumber(value) {
    const match = value.trim().match(/^(.*?)(\d+)$/);
    if (!match) {
      return "1";
    }
    const nextNumber = (BigInt(match[2]) + 1n).toString().padStart(match[2].length, "0");
    return `${match[1]}${nextNumber}`;
  }

  function newEstimate() {
    if (!window.confirm("Создать новую смету? Текущий черновик будет очищен.")) {
      return;
    }

    const number = nextEstimateNumber(numberInput.value);
    pauseDraftSaving = true;
    draftFields.forEach((field) => {
      if (field.tagName === "SELECT") {
        field.selectedIndex = 0;
      } else {
        field.value = field.defaultValue;
      }
    });
    numberInput.value = number;
    setToday();
    positionsBody.replaceChildren();
    document.querySelectorAll(".print-value").forEach((value) => value.remove());
    printTitle.textContent = "Смета";
    addPosition(false);
    pauseDraftSaving = false;
    saveDraft();
    document.getElementById("sender").focus();
  }

  function buildShareText() {
    recalculate();
    const number = numberInput.value.trim() || "____";
    const date = formatPrintDate(dateInput.value) || "____";
    const lines = [`Смета № ${number} от ${date}`];

    for (const [id, label] of [["sender", "От кого"], ["recipient", "Для кого"]]) {
      const value = document.getElementById(id).value.trim();
      if (value) {
        lines.push(`${label}: ${value}`);
      }
    }
    lines.push("");

    for (const row of positionsBody.rows) {
      const name = row.querySelector('[data-field="name"]').value.trim();
      const quantity = row.querySelector('[data-field="quantity"]').value;
      const price = row.querySelector('[data-field="price"]').value;
      const unit = row.querySelector('[data-field="unit"]').value;
      if (!name && !quantity.trim() && !price.trim()) {
        continue;
      }
      const amount = row.querySelector(".line-total").textContent;
      lines.push(`• ${name || "Без наименования"} — ${formatNumber(quantity)} ${unit} × ${formatNumber(price)} ${currencyInput.value} = ${amount}`);
    }

    lines.push("", `Сумма: ${subtotalOutput.textContent}`);
    if (!discountRow.hidden) {
      lines.push(`Скидка: ${discountOutput.textContent}`);
      if (!discountedRow.hidden) {
        lines.push(`Сумма со скидкой: ${discountedOutput.textContent}`);
      }
    }
    if (!vatRow.hidden) {
      lines.push(`НДС: ${vatOutput.textContent}`);
    }
    lines.push(`Итого к оплате: ${grandTotal.textContent}`);

    const comment = document.getElementById("comment").value.trim();
    if (comment) {
      lines.push("", `Комментарий: ${comment}`);
    }
    return lines.join("\n");
  }

  async function copyForWhatsApp() {
    const text = buildShareText();
    clearCopyFeedback();
    const request = copyRequest;
    try {
      await navigator.clipboard.writeText(text);
      if (request !== copyRequest) {
        return;
      }
      copyStatus.textContent = "Скопировано ✓";
      copyTimer = setTimeout(() => {
        copyStatus.textContent = "";
      }, 2000);
    } catch {
      if (request !== copyRequest) {
        return;
      }
      shareText.value = text;
      manualCopy.hidden = false;
      shareText.focus();
      shareText.select();
    }
  }

  function handleDraftChange(event) {
    const field = event.target;
    if (draftFields.includes(field) || (positionsBody.contains(field) && field.matches("[data-field]"))) {
      saveDraft();
      clearCopyFeedback();
    }
  }

  addButton.addEventListener("click", () => addPosition());
  discountInput.addEventListener("input", recalculate);
  vatInput.addEventListener("input", recalculate);
  currencyInput.addEventListener("change", recalculate);
  newEstimateButton.addEventListener("click", newEstimate);
  copyButton.addEventListener("click", copyForWhatsApp);
  document.querySelector(".page").addEventListener("input", handleDraftChange);
  document.querySelector(".page").addEventListener("change", handleDraftChange);
  savePdfButton.addEventListener("click", () => {
    preparePrint();
    window.print();
  });
  window.addEventListener("beforeprint", preparePrint);

  positionsBody.addEventListener("input", (event) => {
    if (event.target.matches('[data-field="quantity"], [data-field="price"]')) {
      recalculate();
    }
  });

  positionsBody.addEventListener("keydown", (event) => {
    if (
      event.key !== "Enter" || event.isComposing || event.defaultPrevented ||
      event.ctrlKey || event.altKey || event.metaKey || event.shiftKey ||
      !event.target.matches("input")
    ) {
      return;
    }

    if (event.target.closest("tr") === positionsBody.lastElementChild) {
      event.preventDefault();
      addPosition();
    }
  });

  positionsBody.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-button");
    if (!removeButton) {
      return;
    }

    const row = removeButton.closest("tr");
    const focusRow = row.nextElementSibling || row.previousElementSibling;
    row.remove();

    if (positionsBody.rows.length === 0) {
      addPosition();
    } else {
      updateRowLabels();
      recalculate();
      focusRow.querySelector('[data-field="name"]').focus();
    }
    saveDraft();
    clearCopyFeedback();
  });

  setToday();
  if (!restoreDraft()) {
    addPosition(false);
  }
  pauseDraftSaving = false;
  saveDraft();
})();
