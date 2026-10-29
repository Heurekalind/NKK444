# Leitfaden zur Datenerhebung

## Allgemein
Alle Georeferenzen müssen in **WGS 84 (EPSG 4326)** Koordinatenreferenzsystem (CRS) erfasst werden, Standorte, die in einem **abweichenden CRS** erfasst werden, können den **falschen Standort** abbilden.
Dies gilt es unbedingt zu vermeiden.

## Punktreferenzierte Maßnahmen
Folgende Maßnahmen können als Punktreferenz angegeben werden:
* Maßnahme B.2 – Straßenbaumpflanzung
* Maßnahme B.3 – Einzelbaumpflanzung (exklusive Sträucher, Hecken)
* Maßnahme B.4 – Standortoptimierung von Bestandsbäumen

Die Koordinaten (Spalten „Breitengrad“ und „Längengrad“) in der Excelvorlage müssen im Dezimalformat mit einer Genauigkeit von mindestens 5 Stellen nach dem Trennzeichen angegeben werden (d. h. 00,00000).
Für die Erfassung von Punktstandorten können derzeit die Datenformate XLSX und GeoJSON eingereicht werden.
Für die Erfassung von Punktstandorten ist die Verwendung von GeoJSON optional, wird jedoch aufgrund seiner Zuverlässigkeit und Flexibilität empfohlen.


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

Für die Erfassung von Linien- oder Polygonstandorten wird ausschließlich das GeoJSON-Formats akzeptiert.
Um das Format einzuhalten, wird empfohlen die Excel-Vorlage zur Erfassung der Maßnahmenbezogenen Daten zu verwenden und diese dann mit einer GIS Software mit den Objektflächen/ Linien zusammen zu führen.
Eine Basis Anleitung wie eine Zusammenführung in Q-GIS geschehen kann finden Sie [hier] (/NKK444_qgis_merge_instructions.pdf).

