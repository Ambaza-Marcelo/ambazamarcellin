/* Suivi public des vols autour du Burundi.
   Aucune clé, aucun serveur : les deux sources sont appelées depuis le navigateur.
   Les textes vivent dans TEXTS (fr, en, rn) pour une traduction ultérieure. */
(function () {
    var ADSB_URL = "https://api.adsb.lol/v2/point/-3.38/29.92/250";
    var OPENSKY_URL = "https://opensky-network.org/api/states/all?lamin=-4.6&lomin=28.8&lamax=-2.2&lomax=31.0";
    var CACHE_KEY = "am-flights-cache";
    var REFRESH_MS = 60000;
    var GEOJSON_URL = "data/burundi.geojson";

    /* Indicatifs OACI. ASKY vole sous SKK, Brussels sous BEL,
       Air Côte d'Ivoire sous VRE : ces alias évitent une compagnie vide. */
    var AIRLINES = {
        ASKY: "ASKY",
        SKK: "ASKY",
        RWD: "RwandAir",
        KQA: "Kenya Airways",
        ETH: "Ethiopian Airlines",
        QTR: "Qatar Airways",
        FDB: "flydubai",
        ATC: "Air Tanzania",
        UGD: "Uganda Airlines",
        BRU: "Brussels Airlines",
        BEL: "Brussels Airlines",
        TCV: "Air Côte d'Ivoire",
        VRE: "Air Côte d'Ivoire",
        SAA: "South African Airways"
    };

    var TYPES = {
        A320: "Airbus A320",
        A20N: "Airbus A320neo",
        A321: "Airbus A321",
        A21N: "Airbus A321neo",
        A332: "Airbus A330-200",
        A333: "Airbus A330-300",
        A359: "Airbus A350-900",
        B738: "Boeing 737-800",
        B38M: "Boeing 737 MAX 8",
        B739: "Boeing 737-900",
        B772: "Boeing 777-200",
        B77W: "Boeing 777-300ER",
        B788: "Boeing 787-8",
        B789: "Boeing 787-9",
        AT76: "ATR 72",
        DH8D: "Dash 8 Q400",
        E190: "Embraer 190",
        CRJ9: "CRJ-900"
    };

    var TEXTS = {
        fr: {
            kicker: "Ciel en direct",
            title: "Avions au-dessus du Burundi",
            intro: "Les appareils détectés au-dessus du pays et dans ses environs. Le ciel se rafraîchit chaque minute.",
            refresh: "Actualiser",
            refreshing: "Actualisation…",
            countOne: "{n} avion détecté · mis à jour à {time} (heure de Bujumbura)",
            countMany: "{n} avions détectés · mis à jour à {time} (heure de Bujumbura)",
            empty: "Aucun avion détecté pour le moment, la couverture radar au-dessus du Burundi est encore limitée. Revenez plus tard !",
            error: "Impossible de joindre les services de suivi pour le moment. Les données en direct sont temporairement inaccessibles.",
            cached: "Affichage de la dernière mise à jour enregistrée sur cet appareil.",
            loading: "Recherche des avions au-dessus du Burundi…",
            mapLoading: "La carte se charge…",
            mapError: "La carte n'a pas pu être chargée. La liste des vols reste disponible.",
            over: "Au-dessus du Burundi",
            near: "À proximité",
            legendOver: "Au-dessus du Burundi",
            legendNear: "À proximité",
            airline: "Compagnie",
            callsign: "Indicatif",
            type: "Type",
            altitude: "Altitude",
            speed: "Vitesse",
            zone: "Zone",
            unknownAirline: "Non identifiée",
            unknownValue: "—",
            meters: "{n} m",
            kmh: "{n} km/h",
            credit: "Données : adsb.lol / OpenSky Network · Réalisé par EGOTEK",
            pageTitle: "Avions au-dessus du Burundi — Ambaza Marcellin"
        },
        en: {
            kicker: "Live sky",
            title: "Aircraft over Burundi",
            intro: "Aircraft detected over the country and nearby. The sky refreshes every minute.",
            refresh: "Refresh",
            refreshing: "Refreshing…",
            countOne: "{n} aircraft detected · updated at {time} (Bujumbura time)",
            countMany: "{n} aircraft detected · updated at {time} (Bujumbura time)",
            empty: "No aircraft detected right now. Radar coverage over Burundi is still limited. Come back a little later!",
            error: "The flight services could not be reached. Live data is temporarily unavailable.",
            cached: "Showing the last update saved on this device.",
            loading: "Looking for aircraft over Burundi…",
            mapLoading: "The map is loading…",
            mapError: "The map could not be loaded. The flight list is still available.",
            over: "Over Burundi",
            near: "Nearby",
            legendOver: "Over Burundi",
            legendNear: "Nearby",
            airline: "Airline",
            callsign: "Callsign",
            type: "Type",
            altitude: "Altitude",
            speed: "Speed",
            zone: "Zone",
            unknownAirline: "Unidentified",
            unknownValue: "—",
            meters: "{n} m",
            kmh: "{n} km/h",
            credit: "Data: adsb.lol / OpenSky Network · Made by EGOTEK",
            pageTitle: "Aircraft over Burundi — Ambaza Marcellin"
        },
        /* Les clés kirundi peuvent être complétées ici. Une clé vide retombe sur le français. */
        rn: {}
    };

    var root = document.querySelector("[data-flights]");
    if (!root) return;

    var lang = "fr";
    var rings = [];
    var map = null;
    var planeLayer = null;
    var started = false;
    var loading = false;
    var timer = 0;
    var leafletPromise = null;
    var latestPlanes = [];
    var latestAt = null;

    var countEl = root.querySelector("[data-flights-count]");
    var boardEl = root.querySelector("[data-flights-board]");
    var refreshBtn = root.querySelector("[data-flights-refresh]");
    var mapEl = root.querySelector("[data-flights-map]");
    var mapNote = root.querySelector("[data-flights-map-status]");
    var creditEl = root.querySelector("[data-flights-credit]");

    function t(key) {
        var pack = TEXTS[lang] || TEXTS.fr;
        if (pack && pack[key]) return pack[key];
        return TEXTS.fr[key] || "";
    }

    function fill(template, values) {
        return String(template).replace(/\{(\w+)\}/g, function (_, key) {
            return values[key] == null ? "" : String(values[key]);
        });
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
        });
    }

    function readLang() {
        try {
            return localStorage.getItem("am-lang") || "fr";
        } catch (error) {
            return "fr";
        }
    }

    function bujumburaTime(date) {
        try {
            return new Intl.DateTimeFormat("fr-FR", {
                timeZone: "Africa/Bujumbura",
                hour: "2-digit",
                minute: "2-digit"
            }).format(date);
        } catch (error) {
            var shifted = new Date(date.getTime() + 2 * 60 * 60 * 1000);
            var hours = String(shifted.getUTCHours()).padStart(2, "0");
            var minutes = String(shifted.getUTCMinutes()).padStart(2, "0");
            return hours + ":" + minutes;
        }
    }

    function airlineFrom(callsign) {
        var code = String(callsign || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        var keys = Object.keys(AIRLINES).sort(function (a, b) { return b.length - a.length; });
        for (var i = 0; i < keys.length; i += 1) {
            if (code.indexOf(keys[i]) === 0) return AIRLINES[keys[i]];
        }
        return "";
    }

    function typeName(code) {
        var clean = String(code || "").trim().toUpperCase();
        if (!clean) return "";
        return TYPES[clean] || clean;
    }

    /* Ray casting : vrai si le point est dans l'anneau [lon, lat]. */
    function ringContains(ring, lon, lat) {
        var inside = false;
        for (var i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
            var yi = ring[i][1];
            var yj = ring[j][1];
            var xi = ring[i][0];
            var xj = ring[j][0];
            var crosses = (yi > lat) !== (yj > lat);
            if (crosses && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    }

    function isOverBurundi(lat, lon) {
        for (var i = 0; i < rings.length; i += 1) {
            if (ringContains(rings[i], lon, lat)) return true;
        }
        return false;
    }

    function collectRings(geometry) {
        if (!geometry) return;
        if (geometry.type === "Polygon") rings.push(geometry.coordinates[0]);
        if (geometry.type === "MultiPolygon") {
            geometry.coordinates.forEach(function (polygon) { rings.push(polygon[0]); });
        }
    }

    function numberOrNull(value) {
        var n = typeof value === "number" ? value : Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function fromAdsb(payload) {
        var list = payload && Array.isArray(payload.ac) ? payload.ac : [];
        return list.map(normalizeAdsb).filter(Boolean);
    }

    function normalizeAdsb(item) {
        var lat = numberOrNull(item.lat);
        var lon = numberOrNull(item.lon);
        if (lat == null || lon == null) return null;
        var callsign = String(item.flight || "").trim();
        var feet = numberOrNull(item.alt_baro);
        var knots = numberOrNull(item.gs);
        var track = numberOrNull(item.track);
        return {
            callsign: callsign,
            type: typeName(item.t),
            airline: airlineFrom(callsign),
            lat: lat,
            lon: lon,
            track: track == null ? 0 : track,
            altM: feet == null ? null : Math.round(feet * 0.3048),
            speedKmh: knots == null ? null : Math.round(knots * 1.852)
        };
    }

    function fromOpenSky(payload) {
        var states = payload && Array.isArray(payload.states) ? payload.states : [];
        return states.map(function (state) {
            if (!state) return null;
            var lon = numberOrNull(state[5]);
            var lat = numberOrNull(state[6]);
            if (lat == null || lon == null) return null;
            var callsign = String(state[1] || "").trim();
            var meters = numberOrNull(state[7]);
            var metersPerSecond = numberOrNull(state[9]);
            var track = numberOrNull(state[10]);
            return {
                callsign: callsign,
                type: "",
                airline: airlineFrom(callsign),
                lat: lat,
                lon: lon,
                track: track == null ? 0 : track,
                altM: meters == null ? null : Math.round(meters),
                speedKmh: metersPerSecond == null ? null : Math.round(metersPerSecond * 3.6)
            };
        }).filter(Boolean);
    }

    function tagZones(planes) {
        planes.forEach(function (plane) {
            plane.over = isOverBurundi(plane.lat, plane.lon);
        });
        planes.sort(function (a, b) {
            if (a.over !== b.over) return a.over ? -1 : 1;
            return String(a.callsign).localeCompare(String(b.callsign));
        });
        return planes;
    }

    function readCache() {
        try {
            var raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.planes)) return null;
            return parsed;
        } catch (error) {
            return null;
        }
    }

    function writeCache(planes, source) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                savedAt: Date.now(),
                source: source,
                planes: planes
            }));
        } catch (error) {
            /* Le quota ou un mode privé n'empêchent pas l'affichage en cours. */
        }
    }

    function fetchJson(url) {
        var controller = typeof AbortController === "function" ? new AbortController() : null;
        var timer = setTimeout(function () {
            if (controller) controller.abort();
        }, 12000);
        return fetch(url, controller ? { signal: controller.signal } : undefined).then(function (response) {
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response.json();
        }).finally(function () {
            clearTimeout(timer);
        });
    }

    /* adsb.lol d'abord. OpenSky seulement si la première source échoue vraiment. */
    function loadLive() {
        return fetchJson(ADSB_URL).then(function (payload) {
            return { source: "adsb.lol", planes: tagZones(fromAdsb(payload)) };
        }).catch(function () {
            return fetchJson(OPENSKY_URL).then(function (payload) {
                return { source: "opensky", planes: tagZones(fromOpenSky(payload)) };
            });
        });
    }

    function formatMeasure(template, value) {
        if (value == null) return t("unknownValue");
        return fill(template, { n: Number(value).toLocaleString(lang === "en" ? "en-GB" : "fr-FR") });
    }

    function planeIcon(plane) {
        var fill = plane.over ? "#F8E7B0" : "#8C7340";
        var svg = '<svg viewBox="0 0 24 24" width="26" height="26" style="transform:rotate(' + plane.track + 'deg)">' +
            '<path fill="' + fill + '" stroke="#1A1408" stroke-width="0.6" d="M12 1.6 14.1 9.8 21.2 12.4v1.7L14 12.6 13.2 19.4 15.2 20.8v1.1L12 21.1 8.8 21.9v-1.1l2-1.4L10 12.6 2.8 14.1v-1.7L9.9 9.8 12 1.6Z"/>' +
            "</svg>";
        return window.L.divIcon({
            className: "plane-marker",
            html: svg,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
            popupAnchor: [0, -12]
        });
    }

    function popupHtml(plane) {
        var rows = [
            [t("airline"), plane.airline || t("unknownAirline")],
            [t("callsign"), plane.callsign || t("unknownValue")],
            [t("type"), plane.type || t("unknownValue")],
            [t("altitude"), formatMeasure(t("meters"), plane.altM)],
            [t("speed"), formatMeasure(t("kmh"), plane.speedKmh)]
        ];
        return '<dl class="flights-popup">' + rows.map(function (row) {
            return "<div><dt>" + escapeHtml(row[0]) + "</dt><dd><strong>" + escapeHtml(row[1]) + "</strong></dd></div>";
        }).join("") + "</dl>";
    }

    function drawPlanes(planes) {
        if (!map || !planeLayer) return;
        planeLayer.clearLayers();
        planes.forEach(function (plane) {
            window.L.marker([plane.lat, plane.lon], { icon: planeIcon(plane), keyboard: true })
                .bindPopup(popupHtml(plane))
                .addTo(planeLayer);
        });
    }

    function renderBoard(planes) {
        if (!planes.length) {
            boardEl.innerHTML = '<p class="flights-status">' + escapeHtml(t("empty")) + "</p>";
            return;
        }
        var head = "<thead><tr>" +
            "<th>" + escapeHtml(t("airline")) + "</th>" +
            "<th>" + escapeHtml(t("callsign")) + "</th>" +
            "<th>" + escapeHtml(t("type")) + "</th>" +
            "<th>" + escapeHtml(t("altitude")) + "</th>" +
            "<th>" + escapeHtml(t("speed")) + "</th>" +
            "<th>" + escapeHtml(t("zone")) + "</th>" +
            "</tr></thead>";
        var body = planes.map(function (plane) {
            var zone = plane.over ? t("over") : t("near");
            var badge = '<span class="flights-badge' + (plane.over ? " is-over" : "") + '">' + escapeHtml(zone) + "</span>";
            var cells = [
                plane.airline || t("unknownAirline"),
                plane.callsign || t("unknownValue"),
                plane.type || t("unknownValue"),
                formatMeasure(t("meters"), plane.altM),
                formatMeasure(t("kmh"), plane.speedKmh)
            ];
            var labels = [t("airline"), t("callsign"), t("type"), t("altitude"), t("speed"), t("zone")];
            var html = cells.map(function (value, index) {
                return '<td data-label="' + escapeHtml(labels[index]) + '">' + escapeHtml(value) + "</td>";
            }).join("");
            return "<tr>" + html + '<td data-label="' + escapeHtml(t("zone")) + '">' + badge + "</td></tr>";
        }).join("");
        boardEl.innerHTML = '<div class="flights-table-wrap"><table class="flights-table">' + head + "<tbody>" + body + "</tbody></table></div>";
    }

    function renderCount(count, date) {
        var key = count > 1 ? "countMany" : "countOne";
        countEl.textContent = fill(t(key), { n: count, time: bujumburaTime(date) });
    }

    function render(planes, date, notice) {
        latestPlanes = planes;
        latestAt = date;
        renderCount(planes.length, date);
        renderBoard(planes);
        drawPlanes(planes);
        if (notice) {
            boardEl.insertAdjacentHTML("afterbegin", '<p class="flights-status is-error">' + escapeHtml(notice) + "</p>");
        }
    }

    function applyStaticText() {
        root.querySelectorAll("[data-flights-text]").forEach(function (node) {
            node.textContent = t(node.getAttribute("data-flights-text"));
        });
        if (refreshBtn && !loading) refreshBtn.textContent = t("refresh");
        if (creditEl) creditEl.textContent = t("credit");
        if (mapEl) mapEl.setAttribute("aria-label", t("title"));
        if (mapNote && !map) mapNote.textContent = t("mapLoading");
        var legendOver = root.querySelector("[data-flights-legend-over]");
        var legendNear = root.querySelector("[data-flights-legend-near]");
        if (legendOver) legendOver.textContent = t("legendOver");
        if (legendNear) legendNear.textContent = t("legendNear");
        if (document.body.hasAttribute("data-flights-page")) document.title = t("pageTitle");
        if (latestAt) render(tagZones(latestPlanes), latestAt);
    }

    function setLang(next) {
        lang = TEXTS[next] ? next : "fr";
        try { localStorage.setItem("am-lang", lang); } catch (error) { /* ignore */ }
        document.querySelectorAll("[data-set-lang]").forEach(function (button) {
            var active = button.getAttribute("data-set-lang") === lang;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        });
        applyStaticText();
    }

    function loadLeaflet() {
        if (window.L) return Promise.resolve();
        if (leafletPromise) return leafletPromise;
        leafletPromise = new Promise(function (resolve, reject) {
            var css = document.createElement("link");
            css.rel = "stylesheet";
            css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            css.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
            css.crossOrigin = "";
            document.head.appendChild(css);
            var script = document.createElement("script");
            script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
            script.crossOrigin = "";
            script.onload = function () { resolve(); };
            script.onerror = function () { reject(new Error("leaflet")); };
            document.head.appendChild(script);
        });
        return leafletPromise;
    }

    function initMap() {
        if (map || !mapEl || !window.L) return;
        map = window.L.map(mapEl, { scrollWheelZoom: false, zoomControl: true }).setView([-3.38, 29.92], 7);
        window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 16,
            attribution: "&copy; OpenStreetMap"
        }).addTo(map);
        planeLayer = window.L.layerGroup().addTo(map);
        mapEl.classList.add("is-ready");
        if (mapNote) mapNote.hidden = true;
        drawPlanes(latestPlanes);
        fetch(GEOJSON_URL).then(function (response) {
            if (!response.ok) throw new Error("geojson");
            return response.json();
        }).then(function (geo) {
            (geo.features || []).forEach(function (feature) { collectRings(feature.geometry); });
            window.L.geoJSON(geo, {
                style: { color: "#F8E7B0", weight: 2, fillColor: "#D4AF37", fillOpacity: 0.28 }
            }).addTo(map);
            if (latestPlanes.length) {
                tagZones(latestPlanes);
                renderBoard(latestPlanes);
                drawPlanes(latestPlanes);
            }
            setTimeout(function () { map.invalidateSize(); }, 150);
        }).catch(function () {
            /* Sans contour, les vols restent affichés et classés « à proximité ». */
        });
    }

    function refresh() {
        if (loading) return;
        loading = true;
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = t("refreshing");
        }
        loadLive().then(function (result) {
            writeCache(result.planes, result.source);
            render(result.planes, new Date());
        }).catch(function () {
            var cached = readCache();
            if (cached) {
                render(tagZones(cached.planes), new Date(cached.savedAt), t("error") + " " + t("cached"));
            } else {
                countEl.textContent = t("error");
                boardEl.innerHTML = "";
                drawPlanes([]);
            }
        }).then(function () {
            loading = false;
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = t("refresh");
            }
        });
    }

    function startTimer() {
        if (timer) clearInterval(timer);
        timer = setInterval(function () {
            if (!document.hidden) refresh();
        }, REFRESH_MS);
    }

    function bootMap() {
        loadLeaflet().then(initMap).catch(function () {
            if (mapNote) {
                mapNote.hidden = false;
                mapNote.textContent = t("mapError");
            }
        });
    }

    function start() {
        if (started) return;
        started = true;
        var cached = readCache();
        if (cached) render(tagZones(cached.planes), new Date(cached.savedAt));
        else countEl.textContent = t("loading");
        bootMap();
        refresh();
        startTimer();
    }

    document.addEventListener("am:lang", function (event) {
        if (event.detail && event.detail.lang) setLang(event.detail.lang);
    });
    document.querySelectorAll("[data-set-lang]").forEach(function (button) {
        button.addEventListener("click", function () {
            setLang(button.getAttribute("data-set-lang"));
        });
    });

    if (refreshBtn) refreshBtn.addEventListener("click", function () { start(); refresh(); });

    setLang(readLang());

    if ("IntersectionObserver" in window) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    start();
                    observer.disconnect();
                }
            });
        }, { rootMargin: "240px 0px" });
        observer.observe(root);
    } else {
        start();
    }
})();
