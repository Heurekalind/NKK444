# Leitfaden zur Datenerhebung

## Allgemein
Alle Georeferenzen müssen in **ETRS89 / UTM Zone 32N  (EPSG: 25832)** Koordinatenreferenzsystem (CRS) erfasst werden, Standorte, die in einem **abweichenden CRS** erfasst werden, können den **falschen Standort** abbilden.

## Punktreferenzierte Maßnahmen
Folgende Maßnahmen können als Punktreferenz angegeben werden:
* Maßnahme B.2 – Straßenbaumpflanzung
* Maßnahme B.3 – Einzelbaumpflanzung **B3EB** (exklusive Sträucher, Hecken)
* Maßnahme B.4 – Standortoptimierung von Bestandsbäumen

>Bitte beachten Sie bei der Angabe "Baumart", unbedingt die durch die ["Liste nicht förderfähiger Gehölze"](https://www.kfw.de/PDF/Download-Center/F%C3%B6rderprogramme-(Inlandsf%C3%B6rderung)/PDF-Dokumente/6000005113_M_444_Anhang_1_Mindestanforderungen.pdf) ausgeschlossenen Arten!  
>Zudem müssen der Gattungs- und Artname der wissenschaftlichen Standartschreibweise entsprechen. Die Gattung wird groß, die Art klein geschrieben.

Die Koordinaten (Spalten „Breitengrad“ und „Längengrad“) in der Excelvorlage müssen im Dezimalformat mit einer Genauigkeit von mindestens 5 Stellen nach dem Trennzeichen angegeben werden (d. h. 00,00000).  
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

Für die Erfassung von Linien- oder Polygonstandorten wird ausschließlich das GeoJSON-Formats akzeptiert.
Um das Format einzuhalten, wird empfohlen die Excel-Vorlage zur Erfassung der Maßnahmenbezogenen Daten zu verwenden und diese dann mit einer GIS Software mit den Objektflächen/ Linien zusammen zu führen.  
Eine Basis Anleitung wie eine Zusammenführung in Q-GIS geschehen kann finden Sie [hier] (/NKK444_qgis_merge_instructions.pdf).

