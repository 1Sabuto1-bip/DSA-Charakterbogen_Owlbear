# Aventurischer Heldenbogen für Owlbear Rodeo

Ein eigenständig gestalteter, interaktiver DSA-5-Heldenbogen als Owlbear-Rodeo-Erweiterung.
Der aktuelle Prototyp importiert Optolith-JSON-Dateien der Version 1.5.x und TDC-Helden aus The Dark Aid X.

## Version 0.22.0 – zonengerechte Ausrüstung und gemeinsame Verwaltung

Generator und fertiger Heldenbogen verwenden nun dieselbe zentrale Zuordnungslogik. In jedem Körperfeld erscheinen ausschließlich dafür vorgesehene Gegenstände: Helme am Kopf, Kettenhemden und andere Torso­rüstungen am Torso, Armzeug an den Armen, Beinschutz bei den Beinen sowie Stiefel und Schuhe beim Schuhwerk. Nicht tragbare Ausrüstung bleibt im Rucksack. Eine einzelne Armschiene kann nur einen Arm belegen; für beide Arme werden zwei Exemplare benötigt.

Der digitale Inventarreiter besitzt außerdem eine eigene, durchsuchbare Rüstkammer wie der Charaktergenerator. Kataloggegenstände werden mit ihren vollständigen Werten übernommen und nach Möglichkeit automatisch der passenden freien Körperzone zugeordnet. Die Inventartabelle kennzeichnet jeden Eintrag als **Rucksack** oder mit seiner belegten Körperzone. Alte, unpassende Zuordnungen werden beim Laden automatisch gelöst und in den Rucksack zurückgelegt; auch die PDF-Darstellung verwendet die bereinigten Zuordnungen.

## Version 0.21.0 – Trefferzonen-Ausrüstung und Rucksack

Generator und digitaler Inventarreiter besitzen nun eine kompakte, zusammenhängende Körperzonen-Darstellung für **Kopf, Torso, linken Arm, rechten Arm, Beine und Schuhwerk**. Gekaufte beziehungsweise vorhandene Kleidung und Rüstung lassen sich den Feldern direkt zuordnen; alle nicht zugeordneten Gegenstände erscheinen automatisch im Rucksack. Der Rüstungsschutz wird ausdrücklich je Trefferzone angezeigt und nicht zu einem irreführenden Gesamt-RS addiert.

Der Belastungswert folgt der Trefferzonenregel mit den Faktoren Kopf ×1, Torso ×5, jeder Arm ×2 und jedes Bein ×2. Da die Oberfläche beide Beine kompakt zusammenfasst, zählt deren gemeinsamer RS dort ×4. Aus dem Wert werden Rüstungs-BE sowie der gegebenenfalls zusätzliche Abzug auf GS und INI berechnet. Dieselbe Aufteilung erscheint auf der Ausrüstungsseite des direkt herunterladbaren PDF-Heldenbogens; Schuhwerk wird angezeigt, zählt aber nicht zum RS.

## Version 0.20.0 – eingebettete Originalschriften und bereinigte Ausrüstungspakete

Der herunterladbare Heldenbogen verwendet jetzt die mitgelieferten Schriften **Andalus** und **Gentium Basic**. Andalus gestaltet Titel, Seitenüberschriften und den Heldennamen; Gentium Basic wird in regulärer, fetter und kursiver Form für Felder, Tabellen, Listen und Notizen eingesetzt. Alle vier TrueType-Dateien werden vollständig in das erzeugte PDF eingebettet. Dadurch bleibt das Schriftbild auch auf Geräten erhalten, auf denen die Schriften nicht installiert sind.

Die leeren Verweise auf **Bürgerpaket, Geweihtenpaket, Hexenpaket** und **Magierpaket** wurden aus dem Laufzeitkatalog entfernt. In der Rüstkammer werden ausschließlich die sechs Pakete mit einer tatsächlich hinterlegten kaufbaren Inhaltsliste angeboten.

## Version 0.19.0 – druckbarer Heldenbogen als PDF

Im letzten Generatorschritt steht jetzt **PDF herunterladen** zur Verfügung. Der Generator erstellt direkt im Browser einen eigenständigen, druckoptimierten A4-Heldenbogen mit Stammdaten, Eigenschaften, Ressourcen, AP-Bilanz, Vorteilen, Nachteilen, Sonderfertigkeiten, allen 59 Talenten, Kampftechniken, Waffen, Rüstungen, Helmen, Zuständen, Tragkraft, Inventar und Geldbeutel. Das Layout greift die klare Themenaufteilung des offiziellen Heldendokuments auf, verwendet aber eine eigenständige, tintensparende Gestaltung mit aventurischen Rahmen, grünen Tabellenköpfen und farbigen Eigenschaftssiegeln.

Weltliche Figuren erhalten vier Grundseiten. Für magisch Begabte wird automatisch eine Seite für Zauber, Rituale, Zaubertricks und magische Sonderfertigkeiten ergänzt; Geweihte erhalten entsprechend eine Seite für Liturgien, Zeremonien, Segnungen und klerikale Sonderfertigkeiten. Der PDF-Download legt den interaktiven Heldenbogen noch nicht an und löscht den gespeicherten Entwurf nicht.

## Version 0.18.0 – Magiebegabung und Zaubersteigerung

Im ersten Generatorschritt lässt sich jetzt festlegen, ob der Held magisch begabt ist. Elfische Herkünfte und magische Professionen aktivieren diese Einstellung automatisch. Nur bei wirksamer Magiebegabung erweitert sich der vorletzte Reiter zu **Talente & Zauber**: enthaltene Professionszauber können von ihrem Startwert aus gesteigert, weitere Zauber und Rituale aus dem vollständigen Katalog gesucht, aktiviert und anschließend erhöht werden. AP-Kosten, Fertigkeitswert-Maximum und die erlaubte Anzahl aktivierter Zauber des Erfahrungsgrads werden live geprüft.

In der Rüstkammer erscheinen nur noch die sechs Ausrüstungspakete, für die eine vollständige kaufbare Inhaltsliste vorliegt. Die vier leeren Regelwiki-Verweise werden nicht mehr als funktionslose Karten angezeigt.

## Version 0.17.2 – adaptive Reiter nach Safari-Prinzip

Die Schrittleiste passt sich jetzt ohne horizontales Scrollen an die verfügbare Fensterbreite an. Wie bei einer kompakten Safari-Tableiste wird der aktive Schritt breiter und zeigt Nummer sowie Bezeichnung; die übrigen Schritte ziehen sich bei wenig Platz auf ihre nummerierten Kreise zusammen. Im breiten Direktstart werden alle Bezeichnungen eingeblendet. Eine leicht transparente, abgerundete Darstellung mit klar hervorgehobenem aktivem Tab sorgt für eine ruhige, zusammenhängende Oberfläche.

## Version 0.17.1 – überlappende Schrittleiste

Die zehn Reiter des Charaktergenerators bilden nun eine überlappende, horizontal fortlaufende Schrittfolge. Jeder Reiter besitzt einen deutlich sichtbaren nummerierten Kreis; erledigte, aktuelle und kommende Schritte sind farblich unterscheidbar. In schmalen Owlbear- und iPad-Fenstern bleibt die Beschriftung erhalten, die Leiste lässt sich seitlich scrollen und zentriert den aktuellen Schritt automatisch.

## Version 0.17.0 – Talentsteigerung und Ausrüstungspakete

Der Charaktergenerator besitzt direkt vor dem Prüfschritt einen neuen Reiter **Talente steigern**. Er startet bei den bereits aus Kultur und Profession übernommenen Fertigkeitswerten, berechnet nur die zusätzlich gewählten Punkte nach der jeweiligen Steigerungsspalte und beachtet das Talentmaximum des Erfahrungsgrads. Die AP werden sofort vom gemeinsamen Konto abgezogen und die Zielwerte in den erzeugten Heldenbogen übernommen.

In der Rüstkammer lassen sich sechs vollständig hinterlegte Ausrüstungspakete mit einem Klick kaufen: **Abenteurerpaket, Adligenpaket, Höhlenforscherpaket, Reisepaket, Stadtpaket** und **Wildnispaket**. Die enthaltenen Gegenstände landen einzeln im Warenkorb und bleiben dort bearbeitbar. Bürger-, Geweihten-, Hexen- und Magierpaket werden ebenfalls aufgeführt, aber klar als noch nicht kaufbar gekennzeichnet, solange ihre verlinkten Regelwiki-Detailseiten keine Inhaltslisten veröffentlichen. Der Info-Knopf steht im normalen Rüstkammerkatalog nun einheitlich direkt rechts neben **Kaufen**.

## Version 0.16.0 – Helme, neues Info-Symbol und Druckvorbereitung

Die Rüstkammer enthält nun alle 16 Helme der aktuellen Regelwiki-Übersicht als eigene Kategorie. Helme werden mit Rüstungstyp, Kopf-RS, Preis, Gewicht, Vorteil, Nachteil, Zusatzregel, Quelle und direktem Regelwiki-Link angezeigt und getrennt von Ganzkörperrüstungen in den Heldenbogen übernommen. Das bisher gezeichnete `i` wurde überall durch das gewünschte Bildsymbol ersetzt. Ein zentrales Grafikregister und ein versioniertes Druckdatenmodell bereiten zusätzliche Gestaltungselemente und einen späteren druckbaren Heldenbogen vor; eine Druckschaltfläche ist bewusst noch nicht aktiviert.

## Version 0.15.0 – Rüstkammer mit Regelwiki-Informationen

Der bisherige Ausrüstungsschritt heißt jetzt **Rüstkammer**. Mehr als 1.500 kaufbare Waffen, Schilde, Rüstungen und Ausrüstungsgegenstände sind durchsuchbar. Ein kreisrunder **i-Knopf** zeigt alle vorhandenen Spielwerte, Preis, Gewicht, Herstellungskomplexität, besondere Regelmerkmale sowie Quelle und Seite. Zusätzlich führen Links zur passenden Suche und zur jeweiligen Übersicht im offiziellen DSA-Regelwiki. Dieselben Informationen stehen auch bei der Waffen- und Rüstungssuche im fertigen Heldenbogen zur Verfügung. Die Darstellung des Info-Knopfs wurde für Safari, Maus und Touch korrigiert.

## Version 0.14.0 – Regelwiki-Infos für Sonderfertigkeiten

Im Generator besitzt jede Sonderfertigkeit jetzt einen kleinen **i-Knopf**. Am Mac öffnet sich die Kurzinfo beim Darüberfahren mit der Maus; per Klick bleibt sie geöffnet. Auf iPad und anderen Touch-Geräten öffnet sie sich durch Antippen. Das Fenster zeigt eine kompakte Wirkungsinformation, Voraussetzungen, AP-Kosten beziehungsweise Stufenkosten, Kategorie, Quelle und Seite sowie einen Link zur Suche im offiziellen DSA-Regelwiki. Für 1.237 der 1.243 Sonderfertigkeiten ist eine Kurzbeschreibung und für 1.031 eine strukturierte Voraussetzungsliste verfügbar. Gestaffelte Kosten wie bei **Finte I–III** werden nun ebenfalls korrekt berechnet.

## Version 0.13.0 – vollständiger AP-Reset und erweiterte Professionen

**Neu beginnen** setzt jetzt auch das AP-Konto vollständig zurück: Eigenschaften beginnen wieder bei 8, Kulturpaket und Profession sind abgewählt und sämtliche eigenen Auswahlen sowie Einkäufe sind leer. Die Professionspakete berechnen ihre bereits enthaltenen Pflichtvorteile und Traditionen nicht mehr doppelt. Der Generator enthält nun 564 Professionspakete und Varianten aus 35 Quellen, aufgeteilt in die fünf durchsuchbaren Gruppen **Weltliche**, **Kämpfer**, **Ordensleute**, **Zauberer** und **Geweihte**. Neuere Regelwiki-Pakete wie Shindai, Adoru-Magier, Klingensängerin und Zauberweber der Shakagra, Tahayaschamanin sowie Ojomyaa sind ebenfalls enthalten.

## Version 0.12.0 – Generator-Reset und Ausrüstungseinkauf

Der Charaktergenerator besitzt jetzt den deutlich sichtbaren, abgesicherten Knopf **Neu beginnen**, der den gesamten gespeicherten Entwurf einschließlich Einkauf zurücksetzt. Vor dem Prüfschritt steht ein eigener Ausrüstungseinkauf mit Suche und Filtern für Waffen, Schilde, Rüstungen und Inventar zur Verfügung. Das regelgerechte Startkapital von 750 Silbertalern wird durch **Reich** beziehungsweise **Arm** automatisch um 250 Silbertaler je Stufe verändert. Preise, Mengen, Gesamtgewicht und Restgeld werden live berechnet; gekaufte Gegenstände werden mit allen vorhandenen Kampf- und Rüstungswerten in den fertigen Heldenbogen übernommen.

## Version 0.11.0 – Zustände, Tragkraft und Belastung

Der neue Reiter **Zustände** verwaltet Betäubung, Entrückung, Furcht, Paralyse, Schmerz und Verwirrung in den Stufen 0 bis IV. Schmerz kann automatisch aus den aktuellen LeP berechnet werden. Zustandserschwernisse wirken auf die integrierten 3W20-Proben und körperliche Kampfwerte. Die Tragkraft wird aus `KK × 2` berechnet; Inventargewicht, ausgerüstete Rüstung, zusätzliche Last, Belastungsgewöhnung und je 4 volle Stein Überlast werden getrennt ausgewiesen. Zustände und Traglast werden außerdem an den GM-Gruppenmonitor und die Kartenanzeige übertragen.

## Version 0.10.0 – Erweiterte Regelbände im Charaktergenerator

Auf der Startseite kann ein neuer Held nach dem DSA5-Grundregelwerk (dritte Auflage), Aventurischem Kompendium und Aventurischer Magie I–III erschaffen werden. Der geführte Generator enthält Erfahrungsgrade, zwölf Herkunftsvarianten, 32 Kulturen, 271 Professionspakete und -varianten, jeweils 68 Vor- und Nachteile sowie 482 Sonderfertigkeiten. AP-Konto, Eigenschaftsmaxima, Professionsvoraussetzungen und die 80-AP-Grenzen werden geprüft. Der fertige Charakter wird als normaler interaktiver Heldenbogen geöffnet.

## Enthaltene Funktionen

- geführter Charaktergenerator in zehn Schritten mit 564 Professionspaketen und Varianten aus 35 Quellen
- eigenständigen, druckoptimierten A4-Heldenbogen im letzten Generatorschritt direkt als PDF herunterladen
- Andalus und Gentium Basic vollständig in den PDF-Heldenbogen einbetten
- bedingte PDF-Zusatzseiten für Zauber/Rituale beziehungsweise Liturgien/Zeremonien
- Magiebegabung im Konzept wählen; elfische Herkunft und magische Professionen werden automatisch erkannt
- gemeinsamer Schritt für Talente und über 400 steigerbare Zauber/Rituale mit Aktivierung, AP-Kosten und Erfahrungsgrad-Grenzen
- Talentsteigerung mit Ausgangswerten aus Kultur und Profession, AP-Kosten und Erfahrungsgrad-Maximum
- Generatorentwurf mit **Neu beginnen** vollständig und nach Sicherheitsabfrage zurücksetzen
- abschließende Rüstkammer mit mehr als 1.500 bepreisten Inventar-, Waffen-, Schild-, Helm- und Rüstungseinträgen
- sechs kaufbare Ausrüstungspakete mit einzeln aufgelöstem Warenkorbinhalt; leere Pakete werden ausgeblendet
- getragene Kleidung und Rüstung den sechs Körperfeldern Kopf, Torso, Arme, Beine und Schuhwerk zuordnen
- Rucksack automatisch aus allen nicht am Körper zugeordneten Gegenständen bilden
- Trefferzonen-RS, Belastungswert, Rüstungs-BE und zusätzlichen GS-/INI-Abzug in Generator, Digitalbogen und PDF anzeigen
- Körperzonen-Auswahl auf tatsächlich passende Helme, Torso-, Arm-, Bein- und Fußausrüstung begrenzen
- eine einzelne Armschiene höchstens einem Arm zuordnen
- durchsuchbare Rüstkammer auch im fertigen digitalen Heldenbogen verwenden
- Inventargegenstände im Heldenbogen eindeutig als getragen oder im Rucksack kennzeichnen
- 16 Helme als eigener Bereich mit Kopf-RS und kompakten Regelwiki-Informationen
- bildbasierte Info-Schaltflächen mit Werten, Quelle, Seite und Regelwiki-Link in Rüstkammer und Kampfmenü
- Startkapital, Reich/Arm, Mengen, Ausgaben, Restgeld und Gesamtgewicht automatisch berechnen
- gekaufte Waffen und Rüstungen mit TP, Kampftechnik, AT/PA, RS, BE und weiteren Katalogwerten in den Bogen übernehmen
- Gruppen- und Quellenfilter für 564 Professionspakete sowie 1.243 allgemeine, Kampf- und Magie-Sonderfertigkeiten
- Info-Knopf mit Kurzbeschreibung, Voraussetzungen, Kosten, Quelle und Regelwiki-Link bei allen Sonderfertigkeiten im Generator
- zusätzliche Kulturen, magische Traditionen und Professionszauber aus den drei Magiebänden
- zwergische Geoden, elfische Professionen, Hexen, Druiden, Animisten, Zibiljas und weitere Magiebegabte
- Optolith-JSON, DarkAid-TDC und eigene Owlbear-Sicherungen importieren
- DarkAid-Eigenschaften, Fertigkeiten, Kampftechniken, Zauber, Zaubertricks, Ausrüstung und Geld übernehmen
- alternativ einen leeren Heldenbogen ohne digitale Vorlage anlegen
- Mensch, Elf oder Zwerg als Spezies wählen; Elfen werden automatisch als magisch begabt angelegt
- Name, Eigenschaften, Abenteuerpunkte, Talente und Kampftechniken im manuellen Modus eintragen
- eigener Reiter **Biografie** mit editierbarer Spezies, Kultur und Profession
- durchsuchbare Kataloge mit 29 Speziesvarianten, 40 Kulturen und 315 Professionen
- vollständiger gemeinsamer Katalog mit 211 Vorteilen und 104 Nachteilen aus aktueller Regelwiki und DarkAid-Daten
- Vor- und Nachteile durchsuchen und hinzufügen, inklusive freier Ausprägung und Stufe bearbeiten oder entfernen
- Biografiedaten aus Optolith-Kennungen und DarkAid-TDC-Dateien automatisch übernehmen
- Eigenschaften und Ressourcen anzeigen
- Zustände Betäubung, Entrückung, Furcht, Paralyse, Schmerz und Verwirrung mit Stufen, Regelhinweisen und Gesamterschwernis verwalten
- Schmerz wahlweise automatisch aus den aktuellen LeP bestimmen; ab 8 addierten Zustandsstufen Handlungsunfähigkeit anzeigen
- Tragkraft aus KK × 2 und Belastung je 4 volle Stein Überlast automatisch berechnen
- ausgerüstete Rüstung separat berücksichtigen sowie zusätzliche Last, Tragkraftmodifikator und Belastungsreduktion eintragen
- Zustandsabzüge automatisch auf 3W20-Proben und wirksame Kampfwerte anwenden und an den GM übertragen
- LeP, AsP, KaP und Schicksalspunkte verwalten
- alle 59 Basistalente mit Eigenschaftsproben anzeigen, auch bei Fertigkeitswert 0
- vollständige 3W20-Proben mit Modifikator, FP und QS würfeln
- bedingter Reiter **Zauber**, der nur bei magisch begabten Figuren erscheint
- vorhandene Optolith- und DarkAid-Zauber sowie Zaubertricks mit deutschen Namen anzeigen und durchsuchen
- Zauberproben mit den passenden drei Eigenschaften würfeln
- im manuellen Modus 541 unterschiedliche Zauber und Rituale aus dem gemeinsamen Optolith-/DarkAid-Katalog durchsuchen und mit einem Klick importieren
- für 533 Katalogeinträge die hinterlegte 3W20-Probe anzeigen; Einträge ohne Quelldaten-Probe klar kennzeichnen
- 97 Zaubertricks separat hinzufügen, bearbeiten und entfernen
- Kampftechniken, Waffen, Helme und Rüstungen anzeigen
- Waffen, Helme und Rüstungen über eine durchsuchbare Bibliothek übernehmen oder frei anlegen
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
- versioniertes Druckdatenmodell mit getrennten Bereichen für Waffen, Rüstungen, Helme und Inventar
- zentrales Grafikregister für künftige Porträts, Wappen, Rahmenelemente und Druckdekorationen

Der vollständige Bogen wird im lokalen Browserspeicher abgelegt. Am verknüpften Token werden nur
eine kleine Zusammenfassung, die aktuellen Ressourcen, Eigenschaften und Kampfgrundwerte gespeichert.

Das verwendete Info-Symbol wurde über die vom Projektinhaber angegebene
[Flaticon-Bildadresse](https://cdn-icons-png.flaticon.com/512/61/61093.png) eingebunden und wird für den Betrieb lokal mit ausgeliefert.

Die Namenskataloge für Vor- und Nachteile verbinden die DarkAid-kompatiblen Kennungen mit den
vollständigen Auswahllisten der offiziellen
[DSA-Regelwiki für Vorteile](https://dsa.ulisses-regelwiki.de/vorteilauswahl.html) und
[DSA-Regelwiki für Nachteile](https://dsa.ulisses-regelwiki.de/nachteilauswahl.html).
Es werden nur Namen und Kennungen gespeichert, keine Regeltexte.

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

- Erweiterte Optolith-Kennungen, für die keine öffentlich verfügbare deutsche Namenszuordnung
  existiert, bleiben sichtbar und können im Biografie-Reiter manuell benannt werden.
- Die Astralenergie magischer Figuren wird als Startwert aus 20 plus der höchsten geistigen
  Eigenschaft sowie den importierten Korrekturwerten vorgeschlagen. Da das genaue Leitattribut von
  der Tradition abhängt, bleibt der Wert direkt editierbar. Karmale Maximalwerte werden weiterhin
  nicht automatisch aus Traditionen errechnet.
- Beim Zukauf von AsP und KaP nutzt der Steigerungsreiter mangels vollständig aufgelöster
  Tradition zunächst die höchste Eigenschaft als Obergrenze und weist auf die manuelle Prüfung
  der tatsächlichen Leiteigenschaft hin.
- Sonderfertigkeiten, der Erwerb von Vorteilen und der Abbau von Nachteilen sind noch nicht Teil des
  Steigerungsreiters.
- Der vollständige Bogen wird noch nicht zwischen verschiedenen Geräten synchronisiert.
- Die Token-Verknüpfung überträgt bewusst nur eine kompakte Zusammenfassung.

## Rechtlicher Hinweis

Dies ist ein inoffizielles Fanprojekt und kein Produkt von Ulisses Spiele, Optolith, The Dark Aid oder Owlbear
Rodeo. Es enthält keine Regeltexte oder geschützten Grafiken. „Das Schwarze Auge“ und zugehörige
Bezeichnungen sind Marken ihrer jeweiligen Rechteinhaber.
