// ─── State ───────────────────────────────────────────────────────────────────
/**
 * Typ_licznika IDs resolved from existing records.
 * Fallback values used only if the reference table cannot be read.
 */
const TYP_MAP = { Gaz: null, 'Prąd': null, Woda: null };
let tableName = null;   // table this widget is bound to
let allRecords = [];    // live snapshot of all table rows

// ─── Grist Bootstrap ─────────────────────────────────────────────────────────
grist.ready({
    requiredAccess: 'read table',
    columns: []  // no column mapping – we write directly by column name
});

// Receive all records to resolve Typ_licznika IDs and refresh hints
grist.onRecords(function (records) {
    allRecords = records;
    resolveTypIds(records);
    updateHints(records);
});

// Required to suppress "no onRecord handler" warning in some Grist versions
grist.onRecord(function () { });

// Capture tableId when Grist sends options
grist.onOptions(function (options, interaction) {
    if (interaction && interaction.tableId) {
        tableName = interaction.tableId;
    }
});

// ─── Resolve Typ_licznika references ─────────────────────────────────────────
function resolveTypIds(records) {
    records.forEach(function (r) {
        const typ = r.Typ_licznika;
        if (!typ) return;
        // typ may be an expanded object {id, Typ} or a raw reference integer
        if (typeof typ === 'object' && typ !== null && typ.Typ) {
            const name = typ.Typ.trim();
            if (name in TYP_MAP) TYP_MAP[name] = typ.id;
        }
    });
}

// ─── Last-reading hints ───────────────────────────────────────────────────────
function updateHints(records) {
    const last = { Gaz: null, 'Prąd': null, Woda: null };

    records.forEach(function (r) {
        const typ = typNazwa(r.Typ_licznika);
        if (!typ || !(typ in last)) return;
        const d = dateOf(r.Data);
        if (!last[typ] || d > dateOf(last[typ].Data)) {
            last[typ] = r;
        }
    });

    setHint('hint-gaz', last['Gaz']);
    setHint('hint-woda', last['Woda']);
    setHint('hint-prad', last['Prąd']);
}

function setHint(id, rec) {
    const el = document.getElementById(id);
    if (!rec) { el.textContent = ''; return; }
    el.textContent = 'Ostatni odczyt: ' + rec.Stan_licznika + ' (' + formatDatePL(rec.Data) + ')';
}

/** Return the string name of a Typ_licznika value (object or ref id). */
function typNazwa(typ) {
    if (!typ) return null;
    if (typeof typ === 'object') return typ.Typ;
    for (const [k, v] of Object.entries(TYP_MAP)) {
        if (v === typ) return k;
    }
    return null;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

/** Normalise a Grist date value (epoch-seconds int or ISO string) to a Date. */
function dateOf(val) {
    if (!val) return new Date(0);
    if (typeof val === 'number') return new Date(val * 1000);
    return new Date(val);
}

function formatDatePL(val) {
    const d = dateOf(val);
    if (!d || isNaN(d)) return '?';
    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Convert a YYYY-MM-DD string to a Grist Date value.
 * Grist stores Date columns as integer seconds since 1970-01-01 UTC.
 */
function isoToGristDate(isoStr) {
    const [y, m, d] = isoStr.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 1000;
}

// ─── Set default date on load ─────────────────────────────────────────────────
document.getElementById('data').value = todayISO();

// ─── Save records ─────────────────────────────────────────────────────────────
async function saveRecords() {
    const btn = document.getElementById('btn-save');

    // Collect form values
    const dataVal = document.getElementById('data').value;
    const gazVal = document.getElementById('gaz').value.trim();
    const wodaVal = document.getElementById('woda').value.trim();
    const pradVal = document.getElementById('prad').value.trim();

    // Validation
    if (!dataVal) {
        showStatus('⚠️ Wybierz datę odczytu.', 'error');
        return;
    }
    if (gazVal === '' && wodaVal === '' && pradVal === '') {
        showStatus('⚠️ Wprowadź przynajmniej jeden odczyt.', 'error');
        return;
    }

    const gristDate = isoToGristDate(dataVal);
    const dateLabel = dataVal; // used in Nazwa field

    /** Build a row object for a given meter type. Returns null for invalid input. */
    function makeRow(typStr, stan, typId) {
        const stanNum = parseFloat(stan);
        if (isNaN(stanNum)) return null;

        const lastRec = getLastRecord(typStr);
        const przyrost = lastRec ? Math.max(0, stanNum - lastRec.Stan_licznika) : 0;

        return {
            Data: gristDate,
            Stan_licznika: stanNum,
            Typ_licznika: typId,
            Przyrost_od_ostatniego_zczytania: przyrost,
            Nazwa: `${dateLabel} ${typStr}`
        };
    }

    /** Find the most recent record for a given meter type name. */
    function getLastRecord(typStr) {
        let latest = null;
        allRecords.forEach(function (r) {
            if (typNazwa(r.Typ_licznika) !== typStr) return;
            const d = dateOf(r.Data);
            if (!latest || d > dateOf(latest.Data)) latest = r;
        });
        return latest;
    }

    // Build list of rows to insert
    const rows = [];

    if (gazVal !== '') {
        const typId = TYP_MAP['Gaz'] || await resolveOrCreateTyp('Gaz');
        const row = makeRow('Gaz', gazVal, typId);
        if (row) rows.push(row);
    }
    if (wodaVal !== '') {
        const typId = TYP_MAP['Woda'] || await resolveOrCreateTyp('Woda');
        const row = makeRow('Woda', wodaVal, typId);
        if (row) rows.push(row);
    }
    if (pradVal !== '') {
        const typId = TYP_MAP['Prąd'] || await resolveOrCreateTyp('Prąd');
        const row = makeRow('Prąd', pradVal, typId);
        if (row) rows.push(row);
    }

    if (rows.length === 0) {
        showStatus('⚠️ Wprowadź prawidłowe liczby.', 'error');
        return;
    }

    // UI: loading state
    btn.classList.add('loading');
    btn.disabled = true;
    showStatus('', '');

    try {
        const tbl = await getTableName();
        if (!tbl) {
            throw new Error('Nie można odczytać nazwy tabeli. Upewnij się, że widget jest podłączony do tabeli.');
        }

        const actions = rows.map(row => ['AddRecord', tbl, null, row]);
        await grist.docApi.applyUserActions(actions);

        const suffix = rows.length === 1 ? '' : rows.length < 5 ? 'y' : 'ów';
        showStatus(`✅ Zapisano ${rows.length} rekord${suffix}.`, 'success');
        showToast(`✅ Zapisano ${rows.length} odczyt${suffix}`, 'success');

        // Clear meter inputs, keep date
        document.getElementById('gaz').value = '';
        document.getElementById('woda').value = '';
        document.getElementById('prad').value = '';

    } catch (err) {
        console.error('Błąd zapisu:', err);
        const msg = err && err.message ? err.message : String(err);
        showStatus('❌ Błąd: ' + msg, 'error');
        showToast('❌ Błąd zapisu', 'error');
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// ─── Get bound table name ─────────────────────────────────────────────────────
async function getTableName() {
    if (tableName) return tableName;

    try {
        const widget = await grist.getTable().catch(() => null);
        if (widget) { tableName = widget.tableId; return tableName; }
    } catch { }

    try {
        const sel = await grist.getSelectedTable().catch(() => null);
        if (sel && sel.tableId) { tableName = sel.tableId; return tableName; }
    } catch { }

    return null;
}

// ─── Resolve or create a Typ_licznika entry ───────────────────────────────────
async function resolveOrCreateTyp(typStr) {
    // 1. Try to fetch from the reference table
    try {
        const data = await grist.docApi.fetchTable('Typ_licznika');
        if (data && data.id && data.Typ) {
            for (let i = 0; i < data.id.length; i++) {
                if (data.Typ[i] === typStr) {
                    TYP_MAP[typStr] = data.id[i];
                    return data.id[i];
                }
            }
        }
    } catch (e) {
        console.warn('Could not fetch Typ_licznika:', e);
    }

    // 2. Create a new entry if not found
    try {
        const result = await grist.docApi.applyUserActions([
            ['AddRecord', 'Typ_licznika', null, { Typ: typStr }]
        ]);
        if (result && result.retValues && result.retValues[0]) {
            TYP_MAP[typStr] = result.retValues[0];
            return result.retValues[0];
        }
    } catch (e) {
        console.warn('Could not create Typ_licznika entry:', e);
    }

    // 3. Last-resort fallback IDs
    return { Gaz: 1, 'Prąd': 2, Woda: 3 }[typStr] || 1;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showStatus(msg, type) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = type || '';
    el.style.display = type ? 'block' : 'none';
}

let toastTimer = null;
function showToast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = (type === 'success' ? 'success' : 'error') + ' show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}
