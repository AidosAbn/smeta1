"use strict";

(() => {
  const positionsBody = document.getElementById("positions-body");
  const positionTemplate = document.getElementById("position-template");
  const addButton = document.getElementById("add-position");
  const grandTotal = document.getElementById("grand-total");
  const dateInput = document.getElementById("estimate-date");
  const moneyFormatter = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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

  function lineCents(quantity, price) {
    const amount = quantity * price;
    // Складываем округлённые суммы строк в сотых, чтобы итог совпадал с ними.
    const cents = Math.round((amount + Math.sign(amount) * Number.EPSILON) * 100);
    return Number.isSafeInteger(cents) ? cents : 0;
  }

  function formatMoney(cents) {
    const amount = Number.isFinite(cents) && cents !== 0 ? cents / 100 : 0;
    return `${moneyFormatter.format(amount).replace(/[\u00a0\u202f]/g, " ")} ₸`;
  }

  function recalculate() {
    let totalCents = 0;

    for (const row of positionsBody.rows) {
      const quantity = readNumber(row.querySelector('[data-field="quantity"]').value);
      const price = readNumber(row.querySelector('[data-field="price"]').value);
      const cents = lineCents(quantity, price);
      row.querySelector(".line-total").textContent = formatMoney(cents);
      totalCents += cents;
    }

    const formattedTotal = formatMoney(totalCents);
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
