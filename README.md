# NKK444
Inputs for Datavalidator NKK444

## Description of Excel Templates

The maschine readable colnames are hidden in row six, there are descriptive colnames in row sevent that can be removed, similar to the test row in the *Project location data* template.


### NKK444_point_data_template.xlsx
This template is only used to collect point data.

nkk_objectnumber(int max 5)  
grant_numbter (int 0 to 99999999)  
intervention_ident (B2;B3(Einzelbaumpflanzung);B4)  
report_date (date)  
species (any value, color flag in case exact equal to validation_value, excluded_plants)  
diameter (int 1 to 999)  
planting_year (int 1900 to 2999)  
plant_age (0 to 50)  
latitude (float -90 to 90)  
longitude (float -180 to 180)  

**Second sheet**
validation_values contains list of excluded_plants

### NKK444_poly_data_template.xlsx

nkk_objectnumber(int max 5)  
grant_numbter (int 0 to 99999999)  
intervention_ident (B2;B3(Einzelbaumpflanzung);B4)  
report_date (date)  
area_size ( int 1 to 99999999999999)  
biotope_type ( validation_values, bitope_codes)  
bitope_grade (int 0 to 24)  
mean_biotope_grade (0 to 24, Excel formula calculates mean_biotope_grade where all records share the same grant_number and the same report_date; uses area_size as the weight.)  
latitude (float -90 to 90)  
longitude (float -180 to 180)  
merge_id (string, grant_number_intervention_ident)  

**Second sheet**
validation_values contains bitope codes

## Validator verification rules

### General 
All uploads should be checkt for:
- correct number of cols
- correct col names (nothing added, changed or removed)
- completness of row entries

### NKK444_point_data_template.xlsx

- non eligible shrubs
- Check valid long lat columns

### NKK444_poly_data_template.xlsx
- To add the geometries there is a slightly reworked process (See PDF)
  This process would require the poly file to have a dummy geometry in the geojson??
- Check that there are three different report_date entries for each merge_id
- The dates show, before intervention, after intervention and prognosis(2045).
The mean_biotope_grade for the prognosis year has to be > than before intervention.
This needs to be checked by the validator.



## Nice to have:

	1. I would like a map only depicting germany if possible.
	2. Could we add a flag if the entry in the column "species" in NKK_point.xlsx almost matches the validation_value excluded plants. We cant really deny upload but at least remind them to check the Liste nicht förderfähiger Gehölze 

## To be added 
NKK444_qgis_merge_instructions.pdf
- Create a project core schema for the NKK templates presumably based on json_schema_for_humans 
(german translation to be done by Heurekalind)
-PDF Guide for QGIS merge ( to be done by Heurekalind)
