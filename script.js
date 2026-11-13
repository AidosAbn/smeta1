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
  const moneyFormatter = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  let nextPositionId = 0;

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

  function addPosition(focusName = true) {
    const row = positionTemplate.content.firstElementChild.cloneNode(true);
    const positionId = ++nextPositionId;

    row.querySelectorAll("[data-field]").forEach((field) => {
      field.id = `position-${positionId}-${field.dataset.field}`;
      field.name = field.id;
      field.previousElementSibling.htmlFor = field.id;
    });

    positionsBody.append(row);
    updateRowLabels();
    recalculate();

    if (focusName) {
      row.querySelector('[data-field="name"]').focus();
    }
    return row;
  }

  addButton.addEventListener("click", () => addPosition());
  discountInput.addEventListener("input", recalculate);
  vatInput.addEventListener("input", recalculate);
  currencyInput.addEventListener("change", recalculate);

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
  });

  // Локальная дата браузера: UTC может указывать на предыдущий день.
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  dateInput.value = `${today.getFullYear()}-${month}-${day}`;

  addPosition(false);
})();
