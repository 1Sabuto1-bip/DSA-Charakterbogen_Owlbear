# Aventurischer Heldenbogen für Owlbear Rodeo

Ein eigenständig gestalteter, interaktiver DSA-5-Heldenbogen als Owlbear-Rodeo-Erweiterung.
Der aktuelle Prototyp importiert Optolith-JSON-Dateien der Version 1.5.x und TDC-Helden aus The Dark Aid X.

## Enthaltene Funktionen

- Optolith-JSON, DarkAid-TDC und eigene Owlbear-Sicherungen importieren
- DarkAid-Eigenschaften, Fertigkeiten, Kampftechniken, Zauber, Zaubertricks, Ausrüstung und Geld übernehmen
- alternativ einen leeren Heldenbogen ohne digitale Vorlage anlegen
- Mensch, Elf oder Zwerg als Spezies wählen; Elfen werden automatisch als magisch begabt angelegt
- Name, Eigenschaften, Abenteuerpunkte, Talente und Kampftechniken im manuellen Modus eintragen
- Eigenschaften und Ressourcen anzeigen
- LeP, AsP, KaP und Schicksalspunkte verwalten
- alle 59 Basistalente mit Eigenschaftsproben anzeigen, auch bei Fertigkeitswert 0
- vollständige 3W20-Proben mit Modifikator, FP und QS würfeln
- bedingter Reiter **Zauber**, der nur bei magisch begabten Figuren erscheint
- vorhandene Optolith- und DarkAid-Zauber sowie Zaubertricks mit deutschen Namen anzeigen und durchsuchen
- Zauberproben mit den passenden drei Eigenschaften würfeln
- im manuellen Modus 541 unterschiedliche Zauber und Rituale aus dem gemeinsamen Optolith-/DarkAid-Katalog durchsuchen und mit einem Klick importieren
- für 533 Katalogeinträge die hinterlegte 3W20-Probe anzeigen; Einträge ohne Quelldaten-Probe klar kennzeichnen
- 97 Zaubertricks separat hinzufügen, bearbeiten und entfernen
- Kampftechniken, Waffen und Rüstungen anzeigen
- Waffen und Rüstungen über eine durchsuchbare Bibliothek aus dem integrierten DarkAid-Regelkatalog übernehmen oder frei anlegen
- eine Primärwaffe auswählen und daraus AT/FK, PA und Ausweichen regelgerecht berechnen
- Initiative mit Basiswert, Rüstungs- und Situationsmodifikator direkt im Kampfbereich würfeln; kontrastreiche Anzeige und gut sichtbarer Würfelknopf
- nur für den GM sichtbarer Gruppenmonitor mit LeP, AsP, KaP, Schicksalspunkten, Eigenschaften sowie AT/FK, PA, AW und INI aller verbundenen Helden
- alte oder testweise verbundene Helden als GM aus Übersicht und Kartenanzeige entfernen, ohne den Charaktertoken oder den lokalen Spielerbogen zu löschen
- Live-Aktualisierung der Gruppenwerte über die Metadaten der Charaktertoken
- angeheftete Kartenanzeige mit Heldenname, LeP und automatisch berechnetem Gesundheitszustand
- Gesundheitszustände Gesund, Leicht verletzt, Schwer verwundet und Ohnmächtig farblich unterscheiden
- Statusanzeige zusammen mit dem Charaktertoken bewegen und auch zur erneuten Bogenverknüpfung auswählen
- Nahkampfwerte (TP, AT/PA, Reichweite, TP-Schwelle), Fernkampfwerte (TP, Ladezeit, Reichweiten, Munition) sowie RS, BE, GS-/INI-Abzüge bearbeiten
- Waffen, Schilde und Rüstungen für Optolith-, DarkAid- und manuelle Helden hinzufügen, ändern und löschen
- Inventar und Geldbörse bearbeiten; Gegenstände hinzufügen und löschen
- Inventar nach Kategorie, Name, Gewicht oder Wert sortieren; zusätzliche Gruppen für Lebensmittel, Dokumente, Alchemie, Wertsachen sowie Tiere und Transport
- eigener Reiter **Steigern** mit AP-Guthaben, automatischen Kosten nach den Spalten A–E und Steigerungsprotokoll
- Eigenschaften, Talente, Kampftechniken, bekannte Zauber sowie LeP, AsP und KaP mit AP steigern
- regeltechnische Maximalwerte prüfen, mit gekennzeichneter Spielleiter-/Hausregeloption übergehen und die letzte Steigerung zurücknehmen
- Talente als Favoriten markieren und durchsuchen
- private Notizen speichern
- einen kompakten Ressourcenstand mit einem Owlbear-Charaktertoken verknüpfen
- Spielstand oder die ursprünglichen Optolith-/DarkAid-Daten wieder exportieren

Der vollständige Bogen wird im lokalen Browserspeicher abgelegt. Am verknüpften Token werden nur
eine kleine Zusammenfassung, die aktuellen Ressourcen, Eigenschaften und Kampfgrundwerte gespeichert.

## Gruppenmonitor und Kartenstatus

Jeder Spieler wählt auf der Karte seinen Charaktertoken aus und klickt im Reiter **Übersicht** auf
**Ausgewählten Token verbinden**. Dabei wird oberhalb des Tokens eine farbige Statusanzeige mit LeP
und Gesundheitszustand angelegt. Sie bleibt am Charaktertoken angeheftet und aktualisiert sich bei
Änderungen im Bogen.

Der GM erhält den Reiter **Gruppe**. Dort werden alle verbundenen Helden der aktuellen Szene angezeigt.
Der Gruppenmonitor kann auf der Startseite auch ohne eigenen importierten Helden geöffnet werden. Mit
**Statusanzeigen anlegen** kann der GM fehlende oder wegen Spielerberechtigungen nicht erstellte
Kartenanzeigen gesammelt ergänzen. Über **Aus Übersicht entfernen** kann er einen alten oder nur zum
Test verbundenen Helden einschließlich seiner farbigen Statusanzeige entfernen. Der Charaktertoken
und der lokale Spielerbogen bleiben erhalten. Erst eine bewusste erneute Token-Verknüpfung durch den
Spieler nimmt den Helden wieder in die Übersicht auf.

## Einfacher Start auf dem Mac – ohne npm

1. Die ZIP-Datei vollständig entpacken.
2. Im entpackten Ordner `Start auf Mac.command` doppelt anklicken.
3. Falls macOS die Datei blockiert: Rechtsklick auf die Datei, **Öffnen** wählen und bestätigen.
4. Das Terminalfenster während des Spiels geöffnet lassen.
5. In Owlbear Rodeo `http://localhost:5173/manifest.json` als Erweiterung hinzufügen.

Der Starter verwendet den auf dem Mac verfügbaren lokalen Webserver und öffnet die Vorschau
automatisch. Eine Kurzfassung liegt zusätzlich als `Mac-Anleitung.txt` im Paket.

## Entwicklung mit npm

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm run dev
```

Danach `http://localhost:5173` im Browser öffnen und eine Optolith-JSON oder DarkAid-TDC importieren. Dieser Abschnitt
ist nur nötig, wenn der Quellcode verändert werden soll.

## In Owlbear Rodeo testen

1. `npm run dev` starten.
2. Im Owlbear-Rodeo-Profil **Add Extension** auswählen.
3. Als Installationslink `http://localhost:5173/manifest.json` eintragen.
4. Die Erweiterung im gewünschten Raum aktivieren.
5. Im Raum oben links **Heldenbogen** öffnen und die JSON- oder TDC-Datei importieren.

Hinweis: Je nach Browser müssen Owlbear Rodeo und der lokale Entwicklungsserver beide über einen
zugelassenen sicheren Ursprung erreichbar sein. Für einen dauerhaften Einsatz empfiehlt sich die
Bereitstellung des Produktions-Builds über HTTPS.

## Produktions-Build

```bash
npm run build
```

Der fertige Stand liegt danach in `dist/`. Den kompletten Inhalt dieses Ordners auf einem statischen
HTTPS-Host veröffentlichen und die URL zu `manifest.json` in Owlbear Rodeo eintragen.

## Tests

```bash
npm test
```

Ein konkreter Optolith-Export kann zusätzlich als Integrationstest verwendet werden:

```bash
TEST_HERO_JSON=/pfad/zum/helden.json npm test
```

Ein DarkAid-Export kann auf die gleiche Weise geprüft werden:

```bash
TEST_DARKAID_TDC=/pfad/zum/helden.tdc npm test
```

## Aktuelle Grenzen

- Kultur, Profession, Vor- und Nachteile sowie Sonderfertigkeiten werden noch nicht vollständig
  in eine gemeinsame Darstellung für beide Importformate überführt.
- Die Astralenergie magischer Figuren wird als Startwert aus 20 plus der höchsten geistigen
  Eigenschaft sowie den importierten Korrekturwerten vorgeschlagen. Da das genaue Leitattribut von
  der Tradition abhängt, bleibt der Wert direkt editierbar. Karmale Maximalwerte werden weiterhin
  nicht automatisch aus Traditionen errechnet.
- Beim Zukauf von AsP und KaP nutzt der Steigerungsreiter mangels vollständig aufgelöster
  Tradition zunächst die höchste Eigenschaft als Obergrenze und weist auf die manuelle Prüfung
  der tatsächlichen Leiteigenschaft hin.
- Sonderfertigkeiten, Vorteile und der Abbau von Nachteilen sind noch nicht Teil des
  Steigerungsreiters.
- Der vollständige Bogen wird noch nicht zwischen verschiedenen Geräten synchronisiert.
- Die Token-Verknüpfung überträgt bewusst nur eine kompakte Zusammenfassung.

## Rechtlicher Hinweis

Dies ist ein inoffizielles Fanprojekt und kein Produkt von Ulisses Spiele, Optolith, The Dark Aid oder Owlbear
Rodeo. Es enthält keine Regeltexte oder geschützten Grafiken. „Das Schwarze Auge“ und zugehörige
Bezeichnungen sind Marken ihrer jeweiligen Rechteinhaber.
