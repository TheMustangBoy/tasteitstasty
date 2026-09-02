# Tasty Truck Orders

Erstelle einen ersten hochwertigen, vollständig responsiven Entwurf für die Bestellwebsite des Foodtrucks „Taste It’s Tasty“ am REWE-Parkplatz, Kopernikusstraße 2, 85221 Dachau.

Ziel: Kunden sollen Essen zur Abholung bestellen können. Lieferung soll technisch vorbereitet, aber vorerst deaktiviert sein. Kein Catering, keine Events, keine Getränke.

Design und Branding:
- Moderner Premium-Look passend zu einem Smash-Burger-Foodtruck
- Farbwelt: Schwarz, Gelb und Orange
- Kräftige, markante Typografie
- Mobile-first, schnelle Ladezeiten, klare große Buttons
- Kein typischer Lieferdienst-Look
- Nutze zunächst ein typografisches Logo „TASTE IT’S TASTY – FOOD TRUCK – BURGERS“ als Platzhalter

Standort:
- Taste It’s Tasty
- REWE-Parkplatz
- Kopernikusstraße 2
- 85221 Dachau

Platzhalter-Kontaktdaten:
- Betreiber: Max Mustermann
- Telefon: 01234 567890
- E-Mail: info@tasteitstasty.de

Speisekarte ohne Getränke:
Burger:
- Smash Burger – 7,50 €
- Tripple Smash – 10,50 €
- Chili Cheese – 8,50 €
- Oklahoma Smash – 8,50 €
- BBQ Smash – 7,50 €
- Trüffel Smash – 9,50 €
- Chicken Burger – 8,50 €
- Tasty Burger – 8,50 €
- Veggie Burger – 7,50 €

Beilagen:
- Pommes – 3,50 €
- Süßkartoffel-Pommes – 4,50 €
- Curly Fries – 4,50 €
- Trüffel Fries – 6,50 €

Fleischregel:
- Alle Fleischburger standardmäßig mit Double Patty
- Tripple Smash mit drei Patties

Zutaten:
- Oklahoma Smash: Gurke, Ketchup, Senf, geschmorte Zwiebeln
- Chili Cheese: Gurke, Tomate, Zwiebel, Jalapeños
- Trüffel Smash: Salat, Zwiebel, Gurke, Tomate
- Chicken Burger: Salat, Zwiebel, Gurke, Tomate
- Veggie Burger: Salat, Zwiebel, Gurke, Tomate
- BBQ Smash, Smash Burger und Tripple Smash: Zwiebel, Tomate, Gurke
- Tasty Burger zunächst mit klar gekennzeichnetem Platzhalter für Zutaten

Anpassungen:
- Einziges Extra: Bacon +1,00 €
- Abwählbar, sofern enthalten: Tomate, Zwiebel, Käse, Soße, Salat, Gurke, Jalapeños
- Produktdetail-Dialog mit Zutaten, Abwahlmöglichkeiten, Bacon-Extra, Menge und Preisaktualisierung

Bestelllogik:
- Nur Abholung aktiv
- 15 Minuten Mindestvorlauf
- Abholzeiten im 5-Minuten-Takt
- Maximal 4 Bestellungen pro Zeitfenster
- Bei vollem Zeitfenster automatisch nächstes verfügbares anbieten
- Vorbestellung für später erlauben
- Warenkorb, Checkout und Bestellübersicht

Zahlungen:
- Kreditkarte
- Apple Pay
- Google Pay
- Barzahlung bei Abholung
- Kartenzahlung bei Abholung
- Kein PayPal

Erstelle in diesem ersten Schritt:
1. Startseite mit Hero-Bereich, Standort und klarer CTA „Jetzt bestellen“
2. Moderne Speisekarte mit Kategorien Burger und Beilagen
3. Produktkarten und Produktdetail-Dialog
4. Warenkorb als mobilefreundlicher Drawer oder feste Zusammenfassung
5. Checkout-Oberfläche mit Abholzeit und Zahlungsart
6. Bestellbestätigung als Demo-Zustand
7. Navigationspunkte für Speisekarte, Standort, Öffnungszeiten und rechtliche Seiten
8. Platzhalterseiten für Impressum, Datenschutz und AGB

Wichtig:
- Noch keine echten Zahlungen ausführen
- Noch keine Veröffentlichung
- Noch keine Lieferfunktion sichtbar machen
- Baue zunächst eine überzeugende funktionale Demo mit sauberer Komponentenstruktur und Beispieldaten, die später mit Datenbank und Adminbereich verbunden werden kann.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/51aad688-c61e-4794-b37f-764fc1d332ba).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Admin-Zugang (manuelle Einrichtung)

Es gibt keine öffentliche Registrierung und keinen Demo-Login mehr.

1. Im Backend (Auth → Users) ein Benutzerkonto mit E-Mail + Passwort anlegen.
2. Die UUID dieses Benutzers in die Tabelle `public.admin_users` eintragen:
   `insert into public.admin_users (user_id) values ('<uuid>');`
3. Anschließend Login unter `/admin` mit E-Mail und Passwort.

Nur Konten, die in `public.admin_users` stehen, dürfen Bestellungen sehen und
Katalog-/Einstellungsdaten ändern (durchgesetzt per RLS und `public.is_admin()`).
