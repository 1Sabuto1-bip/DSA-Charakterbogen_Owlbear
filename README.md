# Aventurischer Heldenbogen für Owlbear Rodeo

Ein eigenständig gestalteter, interaktiver DSA-5-Heldenbogen als Owlbear-Rodeo-Erweiterung.
Der aktuelle Prototyp importiert Optolith-JSON-Dateien der Version 1.5.x.

## Enthaltene Funktionen

- Optolith-JSON und eigene Owlbear-Sicherungen importieren
- Eigenschaften und Ressourcen anzeigen
- LeP, AsP, KaP und Schicksalspunkte verwalten
- Basistalente mit Eigenschaftsproben anzeigen
- vollständige 3W20-Proben mit Modifikator, FP und QS würfeln
- Kampftechniken, Waffen, Rüstungen, Inventar und Geldbörse anzeigen
- Talente als Favoriten markieren und durchsuchen
- private Notizen speichern
- einen kompakten Ressourcenstand mit einem Owlbear-Charaktertoken verknüpfen
- Spielstand oder unveränderten Optolith-Export als JSON sichern

Der vollständige Bogen wird im lokalen Browserspeicher abgelegt. Am verknüpften Token werden nur
eine kleine Zusammenfassung und die aktuellen Ressourcen gespeichert.

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

Danach `http://localhost:5173` im Browser öffnen und eine Optolith-JSON importieren. Dieser Abschnitt
ist nur nötig, wenn der Quellcode verändert werden soll.

## In Owlbear Rodeo testen

1. `npm run dev` starten.
2. Im Owlbear-Rodeo-Profil **Add Extension** auswählen.
3. Als Installationslink `http://localhost:5173/manifest.json` eintragen.
4. Die Erweiterung im gewünschten Raum aktivieren.
5. Im Raum oben links **Heldenbogen** öffnen und die JSON importieren.

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

## Aktuelle Grenzen

- Kultur, Profession, Vor- und Nachteile sowie Sonderfertigkeiten liegen im Export nur als
  Optolith-Kennungen vor. Sie werden im Prototyp noch nicht in lesbare Namen aufgelöst.
- Magische und karmale Maximalwerte werden nicht automatisch aus Traditionen errechnet; sie können
  im Bogen eingeblendet und eingetragen werden.
- Der vollständige Bogen wird noch nicht zwischen verschiedenen Geräten synchronisiert.
- Die Token-Verknüpfung überträgt bewusst nur eine kompakte Zusammenfassung.

## Rechtlicher Hinweis

Dies ist ein inoffizielles Fanprojekt und kein Produkt von Ulisses Spiele, Optolith oder Owlbear
Rodeo. Es enthält keine Regeltexte oder geschützten Grafiken. „Das Schwarze Auge“ und zugehörige
Bezeichnungen sind Marken ihrer jeweiligen Rechteinhaber.
