# UX-, Produkt- und Admin-Polish "Tasty Truck Orders"

Alle 15 Punkte werden in bestehenden Dateien umgesetzt — keine parallelen Komponenten. Nicht angefasst: Supabase/Auth/Realtime, Auswahlbegrenzung, Produktduplizieren, Schnellwahl, Vorbereitungszeit.

## Annahmen
- "Auswahl" ersetzt die bisherigen Varianten sichtbar (Label-Ebene) und funktional: keine Vorauswahl mehr, mehrere Einträge einzeln an-/abwählbar. Bisheriges Feld `variants` wird zu `options` erweitert (`{id, name, priceDelta, active, sortOrder}`), Migration alter Daten beim Laden aus localStorage.
- Reihenfolge der Auswahlpunkte im Produktdialog: Zutaten (abwählen) → Extras → Auswahl.
- Pausierte Kategorie/pausierte Bestellannahme = Produkte weiter sichtbar, aber nicht bestellbar (klarer Hinweis statt Verstecken).
- Ton beim Wheel-Scrollen ist standardmäßig an, Schalter im Admin neben dem bestehenden Bestellton.

## Reihenfolge und Abhängigkeiten

**Phase 1 – Datenmodell (Basis für 1, 7, 9, 10)**
`src/context/shop.tsx`
1. `Variant` → `SelectionOption` (`active`, `sortOrder` ergänzt), Feld `variants` → `options` inkl. Migration beim Hydrieren (alte States verlustfrei übernehmen).
2. `CategoryRecord.paused: boolean`, `ShopSettings.ordersPaused: boolean`, `ShopSettings.wheelSoundOn: boolean` (Default: false/false/true).
3. Aktionen ergänzen: `toggleCategoryPaused`, `setOrdersPaused`, `setProductSortOrder(ids)`, `toggleSoldOut(id)`, `setWheelSound`.
4. `orderableMenu` filtert zusätzlich pausierte Kategorien und respektiert `sortOrder`.

**Phase 2 – Wheel Picker (3, 4, 5)**
`src/components/ui/wheel-picker.tsx`
5. Bugfix letzter Eintrag: Padding über echte Spacer-Elemente (`(VISIBLE-1)/2 * ITEM_HEIGHT` oben und unten) statt `scrollPaddingTop`; Index = `Math.round(scrollTop / ITEM_HEIGHT)` gegen die tatsächliche Spacer-Basis, Clamp erst nach Rundung, `scrollHeight`-Rest per `Math.min` absichern.
6. Settle-Timer auf ~90 ms, `scrollend`-Event nutzen wenn verfügbar, sonst Fallback-Timeout.
7. UX: mittlere Zeile stärker hervorgehoben (Farbe/Gewicht/Opacity-Verlauf nach außen), alle Zeilen `w-full text-center`, Klick auf eine Zeile zentriert diese (`scrollToIndex(i, true)`).
8. Feedback: kurzer Tick über WebAudio, wiederverwendet aus `src/lib/admin-sound.ts` (dort `playTick()` ergänzen, gedrosselt auf max. 1 Ton/60 ms, gemeinsamer AudioContext statt neuem pro Ton); `navigator.vibrate?.(8)`. Ton nur wenn `settings.wheelSoundOn`.
9. `WheelField` bleibt der einzige Trigger-Wrapper; beim Öffnen wird auf den aktuellen Wert zentriert (nach Dialog-Mount, `requestAnimationFrame`).

**Phase 3 – Produkt-Editor (1, 2, 13)**
`src/components/admin/product-editor.tsx`
10. Preisfeld: lokaler String-State, leer erlaubt, akzeptiert `12,5` und `12.5`; Parsing/Normalisierung erst beim Speichern; Name und Preis mit `*` und Fehlermeldungen ("Bitte einen Namen eingeben." / "Bitte einen gültigen Preis eingeben.").
11. Speichern → Toast "✓ Gespeichert".
12. Abschnitt "Varianten" → "Auswahl" mit Button "Auswahl hinzufügen", Feldern Name + Aufpreis, Aktiv-Switch, ↑/↓ zum Sortieren.
13. Vorschau-Panel im Editor, das den Kundendialog-Aufbau spiegelt (Zutaten → Extras → Auswahl, Preis live) — Rendering über die bestehende Darstellungslogik, keine zweite Preisformel.

**Phase 4 – Kundenansicht (1, 14)**
`src/components/shop/product-dialog.tsx`, `src/context/cart.tsx`, `src/routes/checkout.tsx`
14. Auswahl-Block: keine Vorauswahl, Mehrfachauswahl per Checkbox, nur aktive Einträge, Preis aktualisiert; Warenkorb-Zeilen zeigen gewählte Auswahl-Einträge.
15. Verfügbarkeitsprüfung vor Bestellabschluss: Produkt aktiv, nicht ausverkauft, Kategorie nicht pausiert, Extras/Auswahl noch vorhanden, Bestellannahme aktiv, Abholzeit noch gültig. Bei Problemen Hinweisbanner mit Liste der betroffenen Positionen und Button "Warenkorb anpassen".
16. Bei `ordersPaused`: Bestellbutton deaktiviert, freundlicher Hinweistext auf Speisekarte, Warenkorbleiste und Checkout; Öffnungszeitenlogik bleibt unverändert.

**Phase 5 – Admin-Liste (7, 8, 15)**
`src/routes/admin.tsx`
17. Suchfeld über Produktname und Kategorie.
18. Pro Produktzeile ein Schnellschalter Verfügbar/Ausverkauft (bestehende `soldOut`-Logik).
19. Sortierung per Drag & Drop mit HTML5-DnD plus Pointer-Events für Touch, zusätzlich ↑/↓-Buttons als Fallback; Ergebnis wird persistiert und bestimmt die Kundenreihenfolge.
20. Kategorie-Pausieren im Katalog-Tab (`catalog-manager.tsx`), globaler Schalter "Online-Bestellungen aktiv/pausiert" oben im Dashboard.

**Phase 6 – Bestellworkflow (6, 11, 12)**
`src/components/admin/order-card.tsx`
21. Statuszeile neu: primärer großer Button je Status ("Bestellung annehmen" → "In Zubereitung" → "Abholbereit"), Ablehnen/Stornieren als sekundäre Aktion mit bestehendem Sicherheitsdialog; Rückschritte als kleine dezente Textbuttons; "Bestellung abschließen" erst im Status "Abholbereit".
22. Neue Bestellungen: 6 Sekunden dezente Pulsation (`animate-pulse`-Variante via Klasse in `src/styles.css`), danach automatisch aus; Bestellton unverändert.
23. Bei "Abholbereit": Bestellnummer prominent (große Display-Type), "Abholbereit seit X Min." bleibt darunter.

## Test- und Validierungsschritte
- Typecheck und Prettier.
- Playwright mobil (390x844) und Desktop:
  - Produkt anlegen: Preis leer tippen, `12,5` und `12.5` speichern, Pflichtfeldfehler prüfen, "✓ Gespeichert".
  - Auswahl-Einträge anlegen, deaktivieren, sortieren; Kundenvorschau abgleichen.
  - Produktsortierung per ↑/↓ und Drag ändern, Reload, Kundenansicht vergleichen.
  - Wheel: erster → Mitte → letzter → erster → letzter mit Maus/Trackpad/Touch (kein Rücksprung auf vorletzten), Zentrierung beim Öffnen, Klick-Zentrierung.
  - Bestellfluss: Warenkorb → Checkout → Abholzeit → Bestellung; danach Produkt im Admin ausverkauft schalten und Verfügbarkeitswarnung im Checkout prüfen.
  - Admin: Annehmen → In Zubereitung → Abholbereit (Bestellnummer prominent) → Abschließen; Ablehnen und Stornieren mit Dialog; Rückschritt.
  - Kategorie pausieren und globaler Pausenschalter: Kundenmeldung sichtbar, Bestellung blockiert.
- Konsole auf Fehler prüfen, Regression an Öffnungszeiten, CSV-Export, Historie und Notizen gegenprüfen.

## Technische Details
- Migration im Reducer/Hydration von `tit-shop-state-v2`: `variants` wird auf `options` gemappt (`active: true`, `sortOrder` = Index), Speicherschlüssel bleibt stabil, damit lokale Daten erhalten bleiben.
- Ton/Haptik zentral in `src/lib/admin-sound.ts` (gemeinsamer AudioContext, Throttle), damit Bestellton und Wheel-Tick nicht kollidieren.
- Drag & Drop ohne neue Abhängigkeit: Pointer-Events plus `sortOrder`-Neuvergabe in `shop.tsx`.
