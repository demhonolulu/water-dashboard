import json

def modify_json_locations(input, output, remove=None, add=None, properties_key="properties"):
    remove = remove or []
    add = add or {}

    # Load JSON
    with open(input, "r") as f:
        data = json.load(f)

    # Modify each object
    for key, obj in data.items():
        props = obj.get(properties_key, {})

        # Remove fields
        for field in remove:
            props.pop(field, None)

        # Add fields
        for field, value in add.items():
            props[field] = value

    # Save result
    with open(output, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Updated JSON saved to {output}")

def modify_json_veoci(input_file, output_file, remove=None, add=None, root_key="Sheet0"):
    remove = remove or []
    add = add or {}

    # Load JSON
    with open(input_file, "r") as f:
        data = json.load(f)

    # Get the list (e.g., data["Sheet0"])
    items = data.get(root_key, [])

    for obj in items:
        # Remove fields
        for field in remove:
            obj.pop(field, None)

        # Add fields
        for field, value in add.items():
            obj[field] = value

    # Save result
    with open(output_file, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Updated JSON saved to {output_file}")

def main():
    
    # location fields
    fields_to_remove_locations = [
        "agency_code", 
        "agency_name",
        "district_code",
        "country_code",
        "country_name",
        "state_code",
        "state_name",
        "county_code",
        "county_name",
        "minor_civil_division_code",
        "basin_code",
        "altitude",
        "altitude_accuracy",
        "altitude_method_code",
        "altitude_method_name",
        "vertical_datum",
        "vertical_datum_name",
        "horizontal_positional_accuracy_code",
        "horizontal_positional_accuracy",
        "horizontal_position_method_code",
        "horizontal_position_method_name",
        "original_horizontal_datum",
        "original_horizontal_datum_name",
        "contributing_drainage_area",
        "time_zone_abbreviation",
        "uses_daylight_savings",
        # all null
        "construction_date",
        "aquifer_code",
        "national_aquifer_code",
        "aquifer_type_code",
        "well_constructed_depth",
        "hole_constructed_depth",
        "depth_source_code",
        "grouping"
    ]

    modify_json_locations("../json/locations.json","../json/temp-locations.json", fields_to_remove_locations, add=None)

    fields_to_remove_veoci = [
        "GeoLocation",
        "GeoLocation - WKT",
        "Last Update",
        "dateTime",
        "Current Gage Height (ft)",
        "Flood Stage Status (Dan Test)",
        "Current Status",
        "Admin Field 1: Minor Flood Stage Identified",
        "Area Name",
        "Admin Field 1.1: Flood Stage",
        "Admin Field: Monitor Flag"
    ]

    modify_json_veoci("../json/veoci-export.json","../json/temp-veoci.json", fields_to_remove_veoci, add=None)

if __name__ == "__main__":
    main()