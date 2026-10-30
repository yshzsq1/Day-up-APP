/* Themed field controls. Values still flow through the existing input/change handlers. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else api.install(root.document, root);
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');
  function dateString(y, m, d) { return `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`; }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
  function validDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return false;
    const [, y, m, d] = match.map(Number);
    return y >= 1 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
  }
  function shiftMonth(year, month, delta) {
    const total = (year - 1) * 12 + month - 1 + delta;
    const bounded = Math.max(0, Math.min(9999 * 12 - 1, total));
    return { year: Math.floor(bounded / 12) + 1, month: bounded % 12 + 1 };
  }
  function calendarCells(year, month) {
    const first = new Date(0); first.setFullYear(year, month - 1, 1); first.setHours(12, 0, 0, 0);
    const start = (first.getDay() + 6) % 7, count = daysInMonth(year, month);
    return Array.from({ length: 42 }, (_, i) => i >= start && i < start + count ? dateString(year, month, i - start + 1) : null);
  }
  function placement(anchor, size, viewport) {
    const gap = 8, margin = 12;
    return {
      left: Math.max(margin, Math.min(anchor.left, viewport.width - size.width - margin)),
      top: Math.max(margin, Math.min(anchor.bottom + gap + size.height <= viewport.height - margin ? anchor.bottom + gap : anchor.top - size.height - gap, viewport.height - size.height - margin))
    };
  }
  function install(doc, win) {
    let active = null;
    const timeButtons = new WeakMap();
    const today = () => { const d = new Date(); return dateString(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
    function close(restoreFocus = true) {
      if (!active) return;
      const { panel, trigger } = active;
      active = null;
      trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-controls');
      panel.remove();
      if (restoreFocus && trigger.isConnected) trigger.focus();
    }
    function place() {
      if (!active) return;
      if (!active.trigger.isConnected) return close(false);
      const p = placement(active.trigger.getBoundingClientRect(), active.panel.getBoundingClientRect(), { width: win.innerWidth, height: win.innerHeight });
      active.panel.style.left = `${p.left}px`; active.panel.style.top = `${p.top}px`;
    }
    function commit(value) {
      const { input } = active, id = input.id;
      if (active.kind === 'time') {
        if (!validTime(value) && ![...input.options].some(o => o.value === value && ['全天', '待安排'].includes(value))) return;
        if (![...input.options].some(o => o.value === value)) {
          const option = doc.createElement('option'); option.value = value; option.textContent = value; input.appendChild(option);
        }
      }
      close(false);
      input.value = value;
      updateTimeButton(input);
      input.dispatchEvent(new win.Event('input', { bubbles: true }));
      input.dispatchEvent(new win.Event('change', { bubbles: true }));
      // The main date filter may have rendered a fresh field; form fields keep their identity.
      (doc.getElementById(id) || input).focus();
      timeButtons.get(input)?.focus();
    }
    function updateTimeButton(input) {
      const button = timeButtons.get(input);
      if (!button) return;
      if (button.textContent !== input.value) button.textContent = input.value;
      button.setAttribute('aria-label', `时间，${input.value}`);
    }
    function enhanceTimes() {
      for (const input of doc.querySelectorAll('select[data-field="time"]')) {
        if (timeButtons.get(input)?.isConnected) { updateTimeButton(input); continue; }
        const button = doc.createElement('button'); button.type = 'button'; button.id = `${input.id}-trigger`;
        button.className = 'form-control time-trigger'; button.setAttribute('data-time-for', input.id);
        button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
        input.hidden = true; input.after(button); timeButtons.set(input, button);
        doc.querySelector(`label[for="${input.id}"]`)?.setAttribute('for', button.id);
        updateTimeButton(input);
      }
      if (active && !active.input.isConnected) close(false);
    }
    function renderTime(focusPart) {
      const a = active;
      const value = a.concrete ? `${pad(a.hour)}:${pad(a.minute)}` : a.input.value;
      a.panel.innerHTML = `<div class="time-heading"><strong>选择时间 <span class="time-readout">${value}</span></strong><button type="button" data-picker="close" aria-label="关闭时间选择">×</button></div>` +
        (a.special.length ? `<div class="time-special">${a.special.map(s => `<button type="button" data-picker="special" data-value="${s}" aria-pressed="${!a.concrete && a.input.value === s}">${s}</button>`).join('')}</div>` : '') +
        `<div class="time-sections"><section><h3>小时</h3><div class="time-hours" role="group" aria-label="小时">${Array.from({ length: 24 }, (_, h) => `<button type="button" data-picker="hour" data-hour="${h}" aria-label="${pad(h)}时" aria-pressed="${a.concrete && h === a.hour}" tabindex="${h === a.hour ? 0 : -1}">${pad(h)}</button>`).join('')}</div></section><section><h3>分钟</h3><div class="time-minutes" role="group" aria-label="分钟">${a.minutes.map(m => `<button type="button" data-picker="minute" data-minute="${m}" aria-label="${pad(m)}分" aria-pressed="${a.concrete && m === a.minute}" tabindex="${m === a.minute ? 0 : -1}">${pad(m)}</button>`).join('')}</div><p class="picker-hint">每 5 分钟一档</p></section></div>` +
        '<div class="picker-footer"><button type="button" data-picker="close">取消</button><button type="button" class="picker-apply" data-picker="apply">确定</button></div>';
      place();
      if (focusPart) a.panel.querySelector(`[data-${focusPart}="${a[focusPart]}"]`)?.focus();
    }
    function openTime(trigger) {
      if (active?.trigger === trigger) return close();
      close(false);
      const input = doc.getElementById(trigger.dataset.timeFor);
      if (!input) return;
      const current = validTime(input.value) ? input.value : '09:00';
      const hour = Number(current.slice(0, 2)), minute = Number(current.slice(3));
      const panel = doc.createElement('div'); panel.className = 'picker-panel time-panel'; panel.id = 'field-picker';
      panel.setAttribute('popover', 'manual'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '选择时间');
      (trigger.closest('.modal') || doc.body).appendChild(panel);
      active = { kind: 'time', panel, input, trigger, hour, minute, concrete: validTime(input.value), minutes: [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), minute])].sort((a, b) => a - b), special: [...input.options].map(o => o.value).filter(v => ['全天', '待安排'].includes(v)) };
      trigger.setAttribute('aria-expanded', 'true'); trigger.setAttribute('aria-controls', panel.id);
      renderTime(); panel.showPopover?.(); place(); panel.querySelector(`[data-hour="${hour}"]`)?.focus();
    }
    function renderDate(focusDate) {
      const a = active, selected = a.input.value, current = today();
      const title = `${a.year}年${a.month}月`;
      a.panel.innerHTML = `<div class="picker-heading"><button type="button" data-picker="previous" aria-label="${a.mode === 'month' ? '上一年' : '上一月'}">‹</button><button type="button" class="picker-title" data-picker="mode" aria-label="选择年份和月份">${title} <span aria-hidden="true">⌄</span></button><button type="button" data-picker="next" aria-label="${a.mode === 'month' ? '下一年' : '下一月'}">›</button></div>` +
        (a.mode === 'month'
          ? `<div class="picker-year"><label for="picker-year">年份</label><input id="picker-year" data-picker-year type="number" min="1" max="9999" value="${a.year}" inputmode="numeric" aria-label="跳转年份"></div><div class="picker-months">${Array.from({ length: 12 }, (_, i) => `<button type="button" data-picker="month" data-month="${i + 1}" ${a.month === i + 1 ? 'aria-current="true"' : ''}>${i + 1}月</button>`).join('')}</div>`
          : `<div class="picker-week" aria-hidden="true">${'一二三四五六日'.split('').map(d => `<span>${d}</span>`).join('')}</div><div class="picker-days" role="group" aria-label="${title}">${calendarCells(a.year, a.month).map(value => value ? `<button type="button" class="picker-day" data-picker="day" data-date="${value}" aria-label="${value}" aria-pressed="${value === selected}" ${value === current ? 'aria-current="date"' : ''} tabindex="${value === (focusDate || (validDate(selected) && selected.startsWith(dateString(a.year, a.month, 1).slice(0, 7)) ? selected : dateString(a.year, a.month, 1))) ? 0 : -1}">${Number(value.slice(-2))}</button>` : '<span></span>').join('')}</div>`) +
        `<div class="picker-footer">${a.input.required ? '<span class="picker-hint">选择日期</span>' : '<button type="button" data-picker="clear">清除</button>'}<button type="button" data-picker="today">今天</button><button type="button" data-picker="close">取消</button></div>`;
      place();
      if (focusDate) a.panel.querySelector(`[data-date="${focusDate}"]`)?.focus();
    }
    function openDate(trigger) {
      if (active?.trigger === trigger) return close();
      close(false);
      const input = doc.getElementById(trigger.dataset.target);
      if (!input) return;
      const value = validDate(input.value) ? input.value : today();
      const panel = doc.createElement('div');
      panel.className = 'picker-panel'; panel.id = 'field-picker';
      panel.setAttribute('popover', 'manual'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '选择日期');
      // Popover's top layer escapes the modal's scroll clipping, retaining its focus boundary.
      (trigger.closest('.modal') || doc.body).appendChild(panel);
      active = { kind: 'date', panel, input, trigger, year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)), mode: 'day' };
      trigger.setAttribute('aria-expanded', 'true'); trigger.setAttribute('aria-controls', panel.id);
      renderDate(); panel.showPopover?.(); place();
      panel.querySelector('.picker-day[tabindex="0"]')?.focus();
    }
    doc.addEventListener('click', event => {
      const timeTrigger = event.target.closest('[data-time-for]');
      if (timeTrigger) { event.preventDefault(); event.stopImmediatePropagation(); openTime(timeTrigger); return; }
      const trigger = event.target.closest('[data-action="pick-date"]');
      if (trigger) { event.preventDefault(); event.stopImmediatePropagation(); openDate(trigger); return; }
      if (!active || !active.panel.contains(event.target)) return;
      const button = event.target.closest('[data-picker]');
      if (!button) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const action = button.dataset.picker;
      if (action === 'close') return close();
      if (active.kind === 'time') {
        if (action === 'special') return commit(button.dataset.value);
        if (action === 'apply') return commit(active.concrete ? `${pad(active.hour)}:${pad(active.minute)}` : active.input.value);
        if (action === 'hour') { active.concrete = true; active.hour = Number(button.dataset.hour); renderTime('hour'); }
        if (action === 'minute') { active.concrete = true; active.minute = Number(button.dataset.minute); renderTime('minute'); }
        return;
      }
      if (action === 'day' && validDate(button.dataset.date)) return commit(button.dataset.date);
      if (action === 'today') return commit(today());
      if (action === 'clear' && !active.input.required) return commit('');
      if (action === 'mode') active.mode = active.mode === 'day' ? 'month' : 'day';
      if (action === 'previous' || action === 'next') {
        const delta = action === 'previous' ? -1 : 1;
        Object.assign(active, shiftMonth(active.year, active.month, delta * (active.mode === 'month' ? 12 : 1)));
      }
      if (action === 'month') { const year = Number(active.panel.querySelector('[data-picker-year]').value); if (!Number.isInteger(year) || year < 1 || year > 9999) { active.panel.querySelector('[data-picker-year]').reportValidity(); return; } active.year = year; active.month = Number(button.dataset.month); active.mode = 'day'; }
      renderDate(); active.panel.querySelector(action === 'mode' ? '[data-picker-year]' : action === 'month' ? '.picker-day[tabindex="0"]' : `[data-picker="${action}"]`)?.focus();
    }, true);
    doc.addEventListener('pointerdown', event => {
      if (active && !active.panel.contains(event.target) && !active.trigger.contains(event.target)) close(false);
    }, true);
    doc.addEventListener('keydown', event => {
      if (!active) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
      if (!active.panel.contains(event.target)) return;
      if (event.key === 'Tab') {
        const controls = [...active.panel.querySelectorAll('button:not([tabindex="-1"]),input')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); event.stopImmediatePropagation(); last.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); event.stopImmediatePropagation(); first.focus(); }
        return;
      }
      if (active.kind === 'time') {
        const part = event.target.dataset.picker;
        if (!['hour', 'minute'].includes(part)) return;
        const cols = part === 'hour' ? 4 : 3;
        const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
        if (!(event.key in offsets) && !['Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const values = part === 'hour' ? Array.from({ length: 24 }, (_, i) => i) : active.minutes;
        const index = values.indexOf(active[part]);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : Math.max(0, Math.min(values.length - 1, index + offsets[event.key]));
        active.concrete = true; active[part] = values[next]; renderTime(part); return;
      }
      if (event.target.matches('[data-picker-year]') && event.key === 'Enter') {
        event.preventDefault(); event.stopImmediatePropagation();
        const year = Number(event.target.value);
        if (Number.isInteger(year) && year >= 1 && year <= 9999) { active.year = year; active.mode = 'day'; renderDate(dateString(year, active.month, 1)); }
        else event.target.reportValidity();
        return;
      }
      if (!event.target.dataset.date) return;
      const date = event.target.dataset.date;
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (!(event.key in offsets) && !['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      let next;
      if (['PageUp', 'PageDown'].includes(event.key)) { const m = shiftMonth(active.year, active.month, event.key === 'PageUp' ? -1 : 1); next = dateString(m.year, m.month, Math.min(Number(date.slice(-2)), daysInMonth(m.year, m.month))); }
      else { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + (event.key === 'Home' ? -((d.getDay() + 6) % 7) : event.key === 'End' ? 6 - ((d.getDay() + 6) % 7) : offsets[event.key])); next = dateString(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
      if (validDate(next)) { active.year = Number(next.slice(0, 4)); active.month = Number(next.slice(5, 7)); renderDate(next); }
    }, true);
    win.addEventListener('resize', () => close());
    doc.addEventListener('scroll', event => { if (active && event.target !== active.panel && !active.panel.contains(event.target)) close(false); }, true);
    doc.addEventListener('change', event => updateTimeButton(event.target));
    enhanceTimes();
    if (win.MutationObserver) new win.MutationObserver(enhanceTimes).observe(doc.body, { childList: true, subtree: true });
    return { close, enhanceTimes };
  }
  return { validDate, validTime, calendarCells, shiftMonth, placement, install };
});
