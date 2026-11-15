/* Suivi public des vols au-dessus du Burundi et des pays voisins.
   Aucune clé, aucun serveur : les sources passent par le proxy Netlify.
   Les textes vivent dans TEXTS (fr, en, rn) pour une traduction ultérieure. */
(function () {
    var ADSB_ZONES = [
        "/api/adsb/v2/point/-3.38/29.92/250",
        "/api/adsb/v2/point/-1.95/30.06/150",
        "/api/adsb/v2/point/-2.5/28.86/200",
        "/api/adsb/v2/point/-3.4/36.7/200",
        "/api/adsb/v2/point/-6.8/39.2/200",
        "/api/adsb/v2/point/-6.17/35.74/200"
    ];
    var OPENSKY_URL = "/api/opensky/states/all?lamin=-12&lomin=26&lamax=1&lomax=41";
    var CACHE_KEY = "am-flights-cache";
    var REFRESH_MS = 60000;
    var GEOJSON_URL = "data/region.geojson";
    var COUNTRY_IDS = ["bdi", "rwa", "tza", "cod"];
    var FILTERS = ["all", "bdi", "rwa", "tza", "cod"];
    var FLAGS = { bdi: "🇧🇮", rwa: "🇷🇼", tza: "🇹🇿", cod: "🇨🇩" };
    var SORT = { bdi: 0, rwa: 1, tza: 2, cod: 3, region: 4 };
    var DRAW = { cod: 0, tza: 1, rwa: 2, bdi: 3 };
    var STYLES = {
        bdi: { color: "#F8E7B0", weight: 2.6, fillColor: "#D4AF37", fillOpacity: 0.42 },
        rwa: { color: "#7DCEA0", weight: 1.6, fillColor: "#7DCEA0", fillOpacity: 0.18 },
        tza: { color: "#5DADE2", weight: 1.6, fillColor: "#5DADE2", fillOpacity: 0.14 },
        cod: { color: "#E59866", weight: 1.6, fillColor: "#E59866", fillOpacity: 0.1 }
    };
    var PLANE_COLORS = {
        bdi: "#F8E7B0",
        rwa: "#7DCEA0",
        tza: "#5DADE2",
        cod: "#E59866",
        region: "#8C7340"
    };

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
        SAA: "South African Airways",
        PRF: "Precision Air",
        CAA: "Compagnie Africaine d'Aviation",
        KDC: "Congo Airways",
        TCH: "Tanzanian Government Flight",
        AUZ: "Auric Air",
        FTZ: "Fastjet"
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
            intro: "Le ciel du Burundi, du Rwanda, de la Tanzanie et de l'est de la RDC. Il se rafraîchit chaque minute.",
            refresh: "Actualiser",
            refreshing: "Actualisation…",
            countOne: "{n} avion dans la région, dont {y} au-dessus du Burundi · mis à jour à {time} (heure de Bujumbura)",
            countMany: "{n} avions dans la région, dont {y} au-dessus du Burundi · mis à jour à {time} (heure de Bujumbura)",
            empty: "Aucun avion détecté pour le moment dans la région. Revenez plus tard !",
            emptyCountry: "Aucun avion détecté pour le moment au-dessus de ce pays.",
            error: "Impossible de joindre les services de suivi pour le moment. Les données en direct sont temporairement inaccessibles.",
            cached: "Affichage de la dernière mise à jour enregistrée sur cet appareil.",
            loading: "Recherche des avions dans la région…",
            mapLoading: "La carte se charge…",
            mapError: "La carte n'a pas pu être chargée. La liste des vols reste disponible.",
            filterAll: "Tous",
            bdi: "Burundi",
            rwa: "Rwanda",
            tza: "Tanzanie",
            cod: "RDC",
            region: "Région",
            country: "Pays survolé",
            airline: "Compagnie",
            callsign: "Indicatif",
            type: "Type",
            altitude: "Altitude",
            speed: "Vitesse",
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
            intro: "The sky over Burundi, Rwanda, Tanzania and eastern DRC. It refreshes every minute.",
            refresh: "Refresh",
            refreshing: "Refreshing…",
            countOne: "{n} aircraft in the region, including {y} over Burundi · updated at {time} (Bujumbura time)",
            countMany: "{n} aircraft in the region, including {y} over Burundi · updated at {time} (Bujumbura time)",
            empty: "No aircraft detected in the region right now. Come back a little later!",
            emptyCountry: "No aircraft detected over this country right now.",
            error: "The flight services could not be reached. Live data is temporarily unavailable.",
            cached: "Showing the last update saved on this device.",
            loading: "Looking for aircraft in the region…",
            mapLoading: "The map is loading…",
            mapError: "The map could not be loaded. The flight list is still available.",
            filterAll: "All",
            bdi: "Burundi",
            rwa: "Rwanda",
            tza: "Tanzania",
            cod: "DRC",
            region: "Region",
            country: "Country overflown",
            airline: "Airline",
            callsign: "Callsign",
            type: "Type",
            altitude: "Altitude",
            speed: "Speed",
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
    var filter = "all";
    var countryRings = { bdi: [], rwa: [], tza: [], cod: [] };
    var map = null;
    var planeLayer = null;
    var started = false;
    var loading = false;
    var timer = 0;
    var leafletPromise = null;
    var latestPlanes = [];
    var latestAt = null;
    var latestNotice = "";

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

    function addRings(id, geometry) {
        if (!geometry || !countryRings[id]) return;
        if (geometry.type === "Polygon") countryRings[id].push(geometry.coordinates[0]);
        if (geometry.type === "MultiPolygon") {
            geometry.coordinates.forEach(function (polygon) {
                countryRings[id].push(polygon[0]);
            });
        }
    }

    function countryAt(lat, lon) {
        var order = ["bdi", "rwa", "cod", "tza"];
        for (var i = 0; i < order.length; i += 1) {
            var rings = countryRings[order[i]];
            for (var j = 0; j < rings.length; j += 1) {
                if (ringContains(rings[j], lon, lat)) return order[i];
            }
        }
        return "region";
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
            hex: String(item.hex || "").toLowerCase(),
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
                hex: String(state[0] || "").toLowerCase(),
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

    function mergePlanes(groups) {
        var seen = {};
        var out = [];
        groups.forEach(function (group) {
            group.forEach(function (plane) {
                var key = plane.hex || (plane.callsign + "@" + plane.lat.toFixed(3) + "," + plane.lon.toFixed(3));
                if (seen[key]) return;
                seen[key] = true;
                out.push(plane);
            });
        });
        return out;
    }

    function tagZones(planes) {
        planes.forEach(function (plane) {
            plane.country = countryAt(plane.lat, plane.lon);
            plane.over = plane.country === "bdi";
        });
        planes.sort(function (a, b) {
            var left = SORT[a.country];
            var right = SORT[b.country];
            if (left == null) left = 4;
            if (right == null) right = 4;
            if (left !== right) return left - right;
            return String(a.callsign).localeCompare(String(b.callsign));
        });
        return planes;
    }

    function visiblePlanes(planes) {
        if (filter === "all") return planes;
        return planes.filter(function (plane) { return plane.country === filter; });
    }

    function countOf(planes, id) {
        if (id === "all") return planes.length;
        var total = 0;
        planes.forEach(function (plane) {
            if (plane.country === id) total += 1;
        });
        return total;
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
        var timeout = setTimeout(function () {
            if (controller) controller.abort();
        }, 12000);
        return fetch(url, controller ? { signal: controller.signal } : undefined).then(function (response) {
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response.json();
        }).finally(function () {
            clearTimeout(timeout);
        });
    }

    function settle(promises) {
        if (typeof Promise.allSettled === "function") return Promise.allSettled(promises);
        return Promise.all(promises.map(function (promise) {
            return Promise.resolve(promise).then(function (value) {
                return { status: "fulfilled", value: value };
            }, function (reason) {
                return { status: "rejected", reason: reason };
            });
        }));
    }

    /* Les six zones partent ensemble. OpenSky ne sert que si elles échouent toutes. */
    function loadLive() {
        return settle(ADSB_ZONES.map(fetchJson)).then(function (results) {
            var groups = [];
            var any = false;
            results.forEach(function (result) {
                if (result.status !== "fulfilled") return;
                any = true;
                groups.push(fromAdsb(result.value));
            });
            if (!any) {
                return fetchJson(OPENSKY_URL).then(function (payload) {
                    return { source: "opensky", planes: fromOpenSky(payload) };
                });
            }
            return { source: "adsb.lol", planes: mergePlanes(groups) };
        });
    }

    function formatMeasure(template, value) {
        if (value == null) return t("unknownValue");
        return fill(template, { n: Number(value).toLocaleString(lang === "en" ? "en-GB" : "fr-FR") });
    }

    function countryLabel(id) {
        var name = t(id || "region");
        return FLAGS[id] ? FLAGS[id] + " " + name : name;
    }

    function planeIcon(plane) {
        var fill = PLANE_COLORS[plane.country] || PLANE_COLORS.region;
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
            [t("country"), countryLabel(plane.country)],
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

    function renderLegend() {
        var legend = root.querySelector(".flights-legend");
        if (!legend) return;
        legend.innerHTML = COUNTRY_IDS.map(function (id) {
            return '<span><i data-swatch="' + id + '" aria-hidden="true"></i>' + escapeHtml(t(id)) + "</span>";
        }).join("");
    }

    function filtersEl() {
        var el = root.querySelector("[data-flights-filters]");
        if (el || !boardEl) return el;
        el = document.createElement("div");
        el.className = "flights-filters";
        el.setAttribute("data-flights-filters", "");
        el.setAttribute("role", "tablist");
        boardEl.parentNode.insertBefore(el, boardEl);
        return el;
    }

    function renderFilters(planes) {
        var el = filtersEl();
        if (!el) return;
        el.innerHTML = FILTERS.map(function (id) {
            var name = id === "all" ? t("filterAll") : t(id);
            var active = filter === id;
            return '<button type="button" role="tab" data-filter="' + id + '" aria-selected="' +
                (active ? "true" : "false") + '" class="' + (active ? "is-active" : "") + '">' +
                escapeHtml(name + " (" + countOf(planes, id) + ")") + "</button>";
        }).join("");
    }

    function renderBoard(planes) {
        if (!planes.length) {
            var message = filter === "all" ? t("empty") : t("emptyCountry");
            boardEl.innerHTML = '<p class="flights-status">' + escapeHtml(message) + "</p>";
            return;
        }
        var labels = [t("country"), t("airline"), t("callsign"), t("type"), t("altitude"), t("speed")];
        var head = "<thead><tr>" + labels.map(function (label) {
            return "<th>" + escapeHtml(label) + "</th>";
        }).join("") + "</tr></thead>";
        var body = planes.map(function (plane) {
            var country = '<span class="flights-badge' + (plane.country === "bdi" ? " is-over" : "") + '">' +
                escapeHtml(countryLabel(plane.country)) + "</span>";
            var values = [
                country,
                escapeHtml(plane.airline || t("unknownAirline")),
                escapeHtml(plane.callsign || t("unknownValue")),
                escapeHtml(plane.type || t("unknownValue")),
                escapeHtml(formatMeasure(t("meters"), plane.altM)),
                escapeHtml(formatMeasure(t("kmh"), plane.speedKmh))
            ];
            return "<tr>" + values.map(function (value, index) {
                return '<td data-label="' + escapeHtml(labels[index]) + '">' + value + "</td>";
            }).join("") + "</tr>";
        }).join("");
        boardEl.innerHTML = '<div class="flights-table-wrap"><table class="flights-table">' + head + "<tbody>" + body + "</tbody></table></div>";
    }

    function renderCount(planes, date) {
        var key = planes.length > 1 ? "countMany" : "countOne";
        countEl.textContent = fill(t(key), {
            n: planes.length,
            y: countOf(planes, "bdi"),
            time: bujumburaTime(date)
        });
    }

    function render(planes, date, notice) {
        tagZones(planes);
        latestPlanes = planes;
        latestAt = date;
        latestNotice = notice || "";
        renderLegend();
        renderCount(planes, date);
        renderFilters(planes);
        var shown = visiblePlanes(planes);
        renderBoard(shown);
        drawPlanes(shown);
        if (latestNotice) {
            boardEl.insertAdjacentHTML("afterbegin", '<p class="flights-status is-error">' + escapeHtml(latestNotice) + "</p>");
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
        renderLegend();
        if (document.body.hasAttribute("data-flights-page")) document.title = t("pageTitle");
        if (latestAt) render(latestPlanes, latestAt, latestNotice);
        else if (countEl) countEl.textContent = t("loading");
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
        map = window.L.map(mapEl, { scrollWheelZoom: false, zoomControl: true }).setView([-5.5, 33.5], 5);
        window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 16,
            attribution: "&copy; OpenStreetMap"
        }).addTo(map);
        planeLayer = window.L.layerGroup().addTo(map);
        mapEl.classList.add("is-ready");
        if (mapNote) mapNote.hidden = true;
        drawPlanes(visiblePlanes(latestPlanes));
        fetch(GEOJSON_URL).then(function (response) {
            if (!response.ok) throw new Error("geojson");
            return response.json();
        }).then(function (geo) {
            var features = (geo.features || []).slice().sort(function (a, b) {
                var left = DRAW[(a.properties && a.properties.id) || ""] || 0;
                var right = DRAW[(b.properties && b.properties.id) || ""] || 0;
                return left - right;
            });
            features.forEach(function (feature) {
                addRings(feature.properties && feature.properties.id, feature.geometry);
            });
            window.L.geoJSON({ type: "FeatureCollection", features: features }, {
                style: function (feature) {
                    var id = feature.properties && feature.properties.id;
                    return STYLES[id] || STYLES.cod;
                }
            }).addTo(map);
            function frameMap() {
                map.invalidateSize();
                map.fitBounds([[1.2, 25.4], [-12.4, 41.3]], { padding: [10, 10] });
            }
            frameMap();
            if (latestAt) render(latestPlanes, latestAt, latestNotice);
            setTimeout(frameMap, 200);
        }).catch(function () {
            /* Sans contour, les vols restent affichés et classés « Région ». */
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
                render(cached.planes, new Date(cached.savedAt), t("error") + " " + t("cached"));
            } else {
                latestAt = null;
                latestNotice = "";
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
        if (cached) render(cached.planes, new Date(cached.savedAt));
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
    root.addEventListener("click", function (event) {
        var node = event.target;
        while (node && node !== root) {
            if (node.getAttribute && node.hasAttribute("data-filter")) {
                filter = node.getAttribute("data-filter") || "all";
                if (latestAt) render(latestPlanes, latestAt, latestNotice);
                return;
            }
            node = node.parentNode;
        }
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
