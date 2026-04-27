document.addEventListener('DOMContentLoaded', () => {
    const timerElement = document.getElementById('time');
    const currentEventElement = document.getElementById('current-event');
    const timeRangeElement = document.getElementById('time-range');
    const eventsContainer = document.getElementById('events-list');
    const currentTimeElement = document.getElementById('current-time');
    const statusElement = document.getElementById('status');
    const legendElement = document.getElementById('legend');
    const eventsRemainingElement = document.getElementById('events-remaining');
    const eventsNextElement = document.getElementById('events-next');
    const filterCurrentEl = document.getElementById('filter-current');
    const filterUpcomingEl = document.getElementById('filter-upcoming');
    const filterPastEl = document.getElementById('filter-past');
    let endTime;
    let timerMode = 'remaining'; // 'remaining' | 'untilStart'
    let timerInterval;
    let currentTimeInterval;
    let refreshInterval;
    let events = [];
    let parsedEvents = [];
    let lastRenderedSignature = '';
    let latestSignature = '';
    let lastOkAt = 0;

    const FILTER_STORAGE_KEY = 'saoCalendar.todayFilters';
    const filterState = {
        current: true,
        upcoming: true,
        past: true,
    };

    function loadFilters() {
        try {
            const raw = localStorage.getItem(FILTER_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (typeof parsed?.current === 'boolean') filterState.current = parsed.current;
            if (typeof parsed?.upcoming === 'boolean') filterState.upcoming = parsed.upcoming;
            if (typeof parsed?.past === 'boolean') filterState.past = parsed.past;
        } catch {
            // ignore
        }
    }

    function saveFilters() {
        try {
            localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterState));
        } catch {
            // ignore
        }
    }

    function syncFilterUi() {
        if (filterCurrentEl) filterCurrentEl.checked = filterState.current;
        if (filterUpcomingEl) filterUpcomingEl.checked = filterState.upcoming;
        if (filterPastEl) filterPastEl.checked = filterState.past;
    }

    function applyFilters() {
        if (!eventsContainer) return;
        const rows = eventsContainer.querySelectorAll('.event-row');
        rows.forEach(row => {
            const show =
                (row.classList.contains('is-current') && filterState.current) ||
                (row.classList.contains('is-upcoming') && filterState.upcoming) ||
                (row.classList.contains('is-past') && filterState.past);
            row.classList.toggle('is-hidden', !show);
        });
    }

    const sourceLabels = {
        0: '0',
        1: '1',
        2: '2',
        3: '3',
        4: '4',
    };

    function toDate(value) {
        if (!value) return null;
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function hhmm(d) {
        return d ? d.toTimeString().slice(0, 5) : '??:??';
    }

    function lastOkText() {
        if (!lastOkAt) return 'never';
        return hhmm(new Date(lastOkAt));
    }

    function formatDurationMs(ms) {
        const totalMinutes = Math.max(0, Math.round(ms / 60000));
        if (totalMinutes < 60) return `${totalMinutes}m`;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h${String(minutes).padStart(2, '0')}m`;
    }

    function formatHmsMs(ms) {
        // Compact countdown: 2h03m05s / 7m05s / 45s
        const safe = Math.max(0, ms);
        const totalSeconds = Math.floor(safe / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;
        }
        if (minutes > 0) {
            return `${minutes}m${String(seconds).padStart(2, '0')}s`;
        }
        return `${seconds}s`;
    }

    function formatHhMmMs(ms) {
        const safe = Math.max(0, ms);
        const totalMinutes = Math.floor(safe / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    function sourceColor(source) {
        const palette = ['#c7c7c7', '#c7c7c7', '#ff7300', '#ff0000', '#0077ff'];
        const idx = Math.abs(Number(source) || 0) % palette.length;
        return palette[idx];
    }

    function sourceLabel(source) {
        const key = Number(source);
        return Object.prototype.hasOwnProperty.call(sourceLabels, key)
            ? sourceLabels[key]
            : String(source);
    }

    function setStatus(text) {
        if (!statusElement) return;
        statusElement.textContent = text;

        statusElement.classList.remove('status-ok', 'status-error', 'status-stale');
        if (text.startsWith('OK:')) {
            statusElement.classList.add('status-ok');
        } else if (text.startsWith('Error (stale):')) {
            statusElement.classList.add('status-stale');
        } else if (text.startsWith('Error:')) {
            statusElement.classList.add('status-error');
        }
    }

    function isDefaultNumericLabels() {
        const keys = Object.keys(sourceLabels);
        if (keys.length === 0) return true;
        return keys.every(k => String(sourceLabels[k]) === String(k));
    }

    function renderLegend() {
        if (!legendElement) return;
        // If labels are just "0,1,2..." then don't show the legend.
        if (isDefaultNumericLabels()) {
            legendElement.textContent = '';
            return;
        }
        const keys = Object.keys(sourceLabels);
        if (keys.length === 0) {
            legendElement.textContent = '';
            return;
        }
        legendElement.innerHTML = keys
            .map(k => {
                const label = sourceLabels[k];
                const color = sourceColor(k);
                return `<span style="color:${color}">${label}</span>`;
            })
            .join(' ');
    }

    function parseEvents(rawEvents) {
        const normalized = (Array.isArray(rawEvents) ? rawEvents : []).map(e => {
            const startDate = toDate(e.start);
            const endDate = toDate(e.end) || startDate;
            return {
                start: e.start,
                end: e.end,
                startDate,
                endDate,
                summary: e.summary || '',
                source: e.source,
            };
        }).filter(e => e.startDate && e.endDate);

        normalized.sort((a, b) => a.startDate - b.startDate);
        return normalized;
    }

    function buildSignature(rawEvents) {
        if (!Array.isArray(rawEvents)) return '';
        return rawEvents
            .map(e => `${e.source}|${e.start}|${e.end}|${e.summary || ''}`)
            .join('\n');
    }

    async function fetchEvents() {
        const started = performance.now();
        setStatus('Fetching events...');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch('http://127.0.0.1:5000/events', {
                signal: controller.signal,
                cache: 'no-store',
            });
            const json = await response.json();
            if (!response.ok) {
                throw new Error(json?.detail || `HTTP ${response.status}`);
            }
            if (json && json.error) {
                throw new Error(json.detail || json.error);
            }

            events = json;
            latestSignature = buildSignature(json);
            parsedEvents = parseEvents(json);
            lastOkAt = Date.now();
            const ms = Math.round(performance.now() - started);
            const t = new Date();
            setStatus(
                `OK: ${parsedEvents.length} events (${ms}ms) @ ${hhmm(t)}`
            );
            return parsedEvents;
        } catch (error) {
            console.error('Error fetching events:', error);
            setStatus(`Error (stale): ${error?.message || error} | last OK @ ${lastOkText()}`);
            // Keep previous events/parsedEvents on failure.
            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    function updateTimer() {
        const now = new Date();
        let timeLeft = endTime - now;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerElement.style.color = 'red';
            // Recompute from cached events first (fast), then refresh in background.
            setTimeout(() => {
                updateFromEvents(parsedEvents);
                refreshEvents(false);
            }, 10);
            return;
        }

        timerElement.textContent = formatHmsMs(timeLeft);
    }

    function startTimerTo(targetDate, mode) {
        endTime = targetDate;
        timerMode = mode;
        document.getElementById('main-content').style.display = 'block';
        timerElement.style.color = '';
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        timerInterval = setInterval(updateTimer, 1000);
        updateTimer();
    }

    function updateFromEvents(parsed) {
        const now = new Date();
        const currentEvent = parsed.find(e => e.startDate <= now && e.endDate >= now);
        const upcomingEvent = currentEvent ? null : parsed.find(e => e.startDate > now);

        if (currentEvent) {
            startTimerTo(currentEvent.endDate, 'remaining');
        } else if (upcomingEvent) {
            startTimerTo(upcomingEvent.startDate, 'untilStart');
        } else {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            endTime = null;
            timerElement.textContent = '00:00:00';
        }
        displayCurrentEvent(parsed);
        updateEventsHeader(parsed);
    }

    function updateEventsHeader(parsed) {
        if (!eventsRemainingElement && !eventsNextElement) return;
        const list = Array.isArray(parsed) ? parsed : parsedEvents;

        const now = new Date();
        const remainingCount = list.filter(e => e.endDate >= now).length;
        if (eventsRemainingElement) {
            const noun = remainingCount === 1 ? 'item' : 'items';
            eventsRemainingElement.textContent = `Remain ${remainingCount} ${noun}`;
        }

        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);
        const dayRemainMs = endOfDay - now;
        const dayTotalMs = 24 * 60 * 60 * 1000;
        const dayRemainPct = Math.max(
            0,
            Math.min(100, Math.round((dayRemainMs / dayTotalMs) * 100))
        );

        const next = list.find(e => e.startDate > now);
        if (eventsNextElement) {
            // Primary goal: show remaining time and % until day rollover.
            // (We keep the next-event computation above in case you want to re-add it later.)
            eventsNextElement.textContent = `Day remain ${formatHhMmMs(dayRemainMs)} (${dayRemainPct}%)`;
        }
    }

    async function refreshEvents(blocking = true) {
        if (blocking) {
            const fetched = await fetchEvents();
            if (fetched === null) return;
            renderLegend();
            updateFromEvents(fetched);
            return;
        }
        fetchEvents().then(fetched => {
            if (fetched === null) return;
            renderLegend();
            updateFromEvents(fetched);
        });
    }

    function displayCurrentEvent(parsed) {
        const now = new Date();
        const currentEvent = parsed.find(e => e.startDate <= now && e.endDate >= now);
        if (currentEvent) {
            currentEventElement.textContent = `${currentEvent.summary}`;
            timeRangeElement.textContent = `${hhmm(currentEvent.startDate)}–${hhmm(currentEvent.endDate)} (${formatDurationMs(currentEvent.endDate - currentEvent.startDate)})`;
            currentEventElement.style.color = sourceColor(currentEvent.source);
        } else {
            const upcomingEvent = parsed.find(e => e.startDate > now);
            if (upcomingEvent) {
                currentEventElement.textContent = `Next->  ${upcomingEvent.summary}`;
                timeRangeElement.textContent = `${hhmm(upcomingEvent.startDate)}–${hhmm(upcomingEvent.endDate)} (${formatDurationMs(upcomingEvent.endDate - upcomingEvent.startDate)})`;
                currentEventElement.style.color = sourceColor(upcomingEvent.source);
            } else {
                currentEventElement.textContent = 'No more events today';
                timeRangeElement.textContent = '00:00';
                currentEventElement.style.color = '';
            }
        }
        displayEvents(parsed);
    }

    function displayEvents(parsed) {
        // Avoid expensive DOM rebuild if nothing changed.
        if (latestSignature === lastRenderedSignature) return;
        lastRenderedSignature = latestSignature;

        const now = new Date();
        const nowMs = now.getTime();
        eventsContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();

        parsed.forEach(e => {
            const row = document.createElement('div');
            row.className = 'event-row';
            row.dataset.startMs = String(e.startDate.getTime());
            row.dataset.endMs = String(e.endDate.getTime());
            row.style.setProperty('--accent', sourceColor(e.source));
            row.style.setProperty('--progress-pct', '0%');
            row.dataset.durationText = formatDurationMs(e.endDate.getTime() - e.startDate.getTime());

            const countdown = document.createElement('div');
            countdown.className = 'event-countdown';

            const main = document.createElement('div');
            main.className = 'event-main';

            const title = document.createElement('div');
            title.className = 'event-title';
            title.textContent = e.summary;

            const time = document.createElement('div');
            time.className = 'event-time';
            time.textContent = `${hhmm(e.startDate)}–${hhmm(e.endDate)}`;

            main.appendChild(title);
            main.appendChild(time);

            // state styling (no yellow)
            if (now > e.endDate) {
                row.classList.add('is-past');
                countdown.textContent = row.dataset.durationText;
            } else if (now >= e.startDate && now <= e.endDate) {
                row.classList.add('is-current');
                countdown.textContent = formatHmsMs(e.endDate.getTime() - nowMs);
                const total = Math.max(1, e.endDate.getTime() - e.startDate.getTime());
                const pct = Math.max(0, Math.min(100, ((nowMs - e.startDate.getTime()) / total) * 100));
                row.style.setProperty('--progress-pct', `${pct.toFixed(2)}%`);
            } else {
                row.classList.add('is-upcoming');
                // Precompute and show the planned work duration (static).
                countdown.textContent = row.dataset.durationText;
            }

            row.appendChild(countdown);
            row.appendChild(main);
            fragment.appendChild(row);
        });

        eventsContainer.appendChild(fragment);
        updateListCountdowns();
        applyFilters();
    }

    function updateListCountdowns() {
        if (!eventsContainer) return;
        const now = Date.now();
        const rows = eventsContainer.querySelectorAll('.event-row');
        rows.forEach(row => {
            const startMs = Number(row.dataset.startMs || '0');
            const endMs = Number(row.dataset.endMs || '0');
            const durationText = row.dataset.durationText || '--:--';
            const countdownEl = row.querySelector('.event-countdown');
            if (!countdownEl) return;

            // Keep row state in sync even when we don't re-render the list.
            row.classList.remove('is-past', 'is-current', 'is-upcoming');
            row.style.setProperty('--progress-pct', '0%');

            if (now > endMs) {
                row.classList.add('is-past');
                countdownEl.textContent = durationText;
                return;
            }
            if (now >= startMs && now <= endMs) {
                // Live countdown only while the event is running.
                row.classList.add('is-current');
                countdownEl.textContent = formatHmsMs(endMs - now);

                const total = Math.max(1, endMs - startMs);
                const pct = Math.max(0, Math.min(100, ((now - startMs) / total) * 100));
                row.style.setProperty('--progress-pct', `${pct.toFixed(2)}%`);
                return;
            }
            // Upcoming: show planned duration and wait.
            row.classList.add('is-upcoming');
            countdownEl.textContent = durationText;
        });

        applyFilters();
    }

    function updateCurrentTime() {
        if (!currentTimeElement) return;
        const now = new Date();
        const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        currentTimeElement.textContent = formattedTime;

        // Keep right header in sync without refetching.
        updateEventsHeader(parsedEvents);
        updateListCountdowns();
    }

    // Boot
    loadFilters();
    syncFilterUi();
    if (filterCurrentEl) {
        filterCurrentEl.addEventListener('change', () => {
            filterState.current = !!filterCurrentEl.checked;
            saveFilters();
            applyFilters();
        });
    }
    if (filterUpcomingEl) {
        filterUpcomingEl.addEventListener('change', () => {
            filterState.upcoming = !!filterUpcomingEl.checked;
            saveFilters();
            applyFilters();
        });
    }
    if (filterPastEl) {
        filterPastEl.addEventListener('change', () => {
            filterState.past = !!filterPastEl.checked;
            saveFilters();
            applyFilters();
        });
    }

    renderLegend();
    refreshEvents(true);
    if (!currentTimeInterval) {
        currentTimeInterval = setInterval(updateCurrentTime, 1000);
    }
    // Refresh periodically to keep in sync without refetching at every boundary.
    if (!refreshInterval) {
        refreshInterval = setInterval(() => refreshEvents(false), 60 * 1000);
    }
});
