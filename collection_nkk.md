# Leitfaden zur Datenerhebung

## Allgemein
Für die Einreichung wird **ETRS89 / UTM Zone 32N (EPSG:25832)** verwendet. Die Karte und das standardkonforme GeoJSON verwenden WGS84. Der Validator kann zwischen beiden umrechnen. Exportieren Sie für die Einreichung ausdrücklich die Datei in EPSG:25832.

Im [Standortvalidator](./validation_nkk.md) können Sie die Standorte ohne separate GIS-Software erfassen. Zeichnen Sie einen Punkt, eine Linie oder eine Fläche und füllen Sie anschließend das Attributformular aus. Für mehrere Geometriebestandteile einer Teilfläche wählen Sie deren Zeile aus und verwenden „Linie hinzufügen“ oder „Fläche hinzufügen“.

Um eine Fläche zu schließen, setzen Sie mindestens drei Eckpunkte und klicken oder tippen Sie anschließend in die Nähe des markierten Startpunkts. Beim Annähern mit der Maus wird der Startpunkt hervorgehoben und die Schließkante eingeblendet. Alternativ wählen Sie „Fläche schließen“.

## Punktreferenzierte Maßnahmen
Folgende Maßnahmen können als Punktreferenz angegeben werden:
* Maßnahme B.2 – Straßenbaumpflanzung
* Maßnahme B.3 – Einzelbaumpflanzung **B3EB** (exklusive Sträucher, Hecken)
* Maßnahme B.4 – Standortoptimierung von Bestandsbäumen

>Bitte beachten Sie bei der Angabe "Baumart", unbedingt die durch die ["Liste nicht förderfähiger Gehölze"](https://www.kfw.de/PDF/Download-Center/F%C3%B6rderprogramme-(Inlandsf%C3%B6rderung)/PDF-Dokumente/6000005113_M_444_Anhang_1_Mindestanforderungen.pdf) ausgeschlossenen Arten!  
>Zudem müssen der Gattungs- und Artname der wissenschaftlichen Standartschreibweise entsprechen. Die Gattung wird groß, die Art klein geschrieben.

Die Koordinaten (Spalten „Breitengrad“ und „Längengrad“) in der Excelvorlage werden als WGS84-Dezimalgrad mit mindestens fünf Nachkommastellen erfasst (z. B. `52,50178`). Den Berichtszeitpunkt geben Sie beim Prüfen der Datei für alle Zeilen gemeinsam an.
Für die Erfassung von Punktstandorten können derzeit die Datenformate XLSX und GeoJSON eingereicht werden.


## Flächen- und Linienreferenzierte Maßnahmen

Folgende Maßnahmen können als Flächen- und/ oder Linienreferenzierte angegeben werden:
* Maßnahme A.3 – Aufwertung von Grünflächen
* Maßnahme B.3 – Einzelpflanzung, Sträucher, Hecken
* Maßnahme C.1 – kleine Parkanlagen
* Maßnahme C.2 – Naturerfahrungsraum
* Maßnahme C.3 – urbane Waldgärten
* Maßnahme C.4 – urbane Wälder
* Maßnahme C.5 – Renaturierung von Kleingewässern
* Maßnahme D.2 – Entsiegelungsmaßnahme
  
>Angaben zu "Biotoptyp Code" entnehmen Sie bitte der[ *"Bundeskompensationsverordnung - BKompV, Anlage 2 (zu § 5 Absatz 1) Liste der Biotoptypen und -werte"*](https://www.gesetze-im-internet.de/bkompv/anlage_2.html).  
>Biotoptypencodes und -werte können je nach Quelle variieren daher **nehmen Sie unbedingt Bezug auf die bereitgestellte Anlage 2.**

Linien und Flächen können als NKK444-GeoJSON oder NKK444-Standortarbeitsmappe gespeichert und erneut geladen werden. Für den bestehenden GIS-Workflow können Sie die phasenbezogenen Excel-Vorlagen mit Objektflächen oder Linien zusammenführen und je Phase eine GeoJSON-Datei laden.
Eine Basis Anleitung wie eine Zusammenführung in Q-GIS geschehen kann finden Sie [hier] (/NKK444_qgis_merge_instructions.pdf).

