import json
import urllib.request
import urllib.error
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Tuple
import os
import time
import statistics

def fetch_usgs_data(id: str, api_key: str, start_date: str, end_date: str, offset: int = 0, limit: int = 50000):
    """Fetch data from USGS API for a specific date range - single call only"""
    base_url = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items"
    
    # Single URL, no pagination
    url = f"{base_url}?f=json&lang=en-US&limit={limit}&properties=time,value,unit_of_measure&skipGeometry=true&sortby=%2Btime&offset={offset}&datetime={start_date}/{end_date}&monitoring_location_id={id}&api_key={api_key}&unit_of_measure=ft"
    
    print(f"  Fetching data for {start_date} to {end_date}...")
    
    try:
        # Create request with headers
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
        
        features = data.get('features', [])
        print(f"    Got {len(features)} features")
        
        return features
        
    except urllib.error.URLError as e:
        print(f"    Error fetching data: {e}")
        print(f"    URL attempted: {url[:200]}...")
        return []
    except json.JSONDecodeError as e:
        print(f"    Error parsing JSON: {e}")
        return []

def calculate_outlier_adjusted_average(values: List[float]) -> float:
    """
    Calculate average excluding outliers using IQR (Interquartile Range) method.
    
    How it works:
    1. Calculate Q1 (25th percentile) and Q3 (75th percentile)
    2. IQR = Q3 - Q1
    3. Define outliers as values below Q1 - 1.5*IQR or above Q3 + 1.5*IQR
    4. Remove outliers and calculate average of remaining values
    
    This gives a "normal baseline" by excluding extreme spikes or dips.
    """
    if len(values) < 4:  # Not enough data for IQR method
        return round(sum(values) / len(values), 2)
    
    sorted_values = sorted(values)
    
    # Calculate Q1 (25th percentile) and Q3 (75th percentile)
    q1_index = int(len(sorted_values) * 0.25)
    q3_index = int(len(sorted_values) * 0.75)
    
    q1 = sorted_values[q1_index]
    q3 = sorted_values[q3_index]
    
    # Calculate IQR and bounds
    iqr = q3 - q1
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    
    # Filter out outliers
    filtered_values = [v for v in values if lower_bound <= v <= upper_bound]
    
    # If we filtered out too many (more than 25%), use median instead
    if len(filtered_values) < len(values) * 0.75:
        # Fall back to median for highly skewed data
        return round(statistics.median(values), 2)
    
    return round(sum(filtered_values) / len(filtered_values), 2)

def process_features_to_monthly_stats(features: List[Dict]) -> Dict[str, List[Tuple[float, str]]]:
    """Process features into monthly data structure"""
    monthly_data: Dict[str, List[Tuple[float, str]]] = defaultdict(list)
    
    print(f"  Processing {len(features)} features...")
    
    for idx, feature in enumerate(features):
        if idx % 10000 == 0 and idx > 0:
            print(f"    Processed {idx}/{len(features)} features...")
            
        properties = feature.get('properties', {})
        time_str = properties.get('time')
        value_str = properties.get('value')
        
        if time_str and value_str:
            try:
                # Parse time to get month
                time_clean = time_str.replace('+00:00', '').replace('Z', '')
                dt = datetime.fromisoformat(time_clean)
                month_key = dt.strftime('%Y-%m')
                
                value = float(value_str)
                monthly_data[month_key].append((value, time_str))
            except (ValueError, TypeError) as e:
                print(f"  Error parsing feature {idx}: time={time_str}, value={value_str}, error={e}")
                continue
    
    return monthly_data

def calculate_monthly_stats(monthly_data: Dict[str, List[Tuple[float, str]]]) -> List[Dict]:
    """Calculate min, max, average with timestamps for each month"""
    monthly_stats = []
    
    for month, data_points in sorted(monthly_data.items()):
        if data_points:
            min_value, min_timestamp = min(data_points, key=lambda x: x[0])
            max_value, max_timestamp = max(data_points, key=lambda x: x[0])
            
            # Get all values for averaging
            all_values = [v for v, _ in data_points]
            
            # Calculate regular average (for reference)
            regular_average = round(sum(all_values) / len(all_values), 2)
            
            # Calculate outlier-adjusted average (for baseline)
            baseline_average = calculate_outlier_adjusted_average(all_values)
            
            # Calculate outliers removed count for this month
            outliers_removed = 0
            if len(all_values) >= 4:
                sorted_vals = sorted(all_values)
                q1_index = int(len(sorted_vals) * 0.25)
                q3_index = int(len(sorted_vals) * 0.75)
                q1 = sorted_vals[q1_index]
                q3 = sorted_vals[q3_index]
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                outliers_removed = sum(1 for v in all_values if v < lower_bound or v > upper_bound)
            
            monthly_stats.append({
                'month': month,
                'max': max_value,
                'max_timestamp': max_timestamp,
                'min': min_value,
                'min_timestamp': min_timestamp,
                'average': regular_average,
                'baseline_average': baseline_average,
                'count': len(data_points),
                'outliers_removed': outliers_removed
            })
    
    return monthly_stats

def update_historic_data(historic_file: str, monitoring_id: str, new_stats: List[Dict]):
    """Update historic-data.json with new statistics"""
    # Read existing data
    historic_data = {}
    if os.path.exists(historic_file):
        try:
            with open(historic_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    historic_data = json.loads(content)
        except (json.JSONDecodeError, FileNotFoundError):
            historic_data = {}
    
    # Merge data
    if monitoring_id in historic_data:
        existing_stats = {stat['month']: stat for stat in historic_data[monitoring_id]}
        for stat in new_stats:
            if stat['month'] in existing_stats:
                # Safely get count with default value if field doesn't exist
                existing_count = existing_stats[stat['month']].get('count', 0)
                print(f"  Merging {stat['month']}: existing {existing_count} records, new {stat['count']} records")
                # Keep the one with more data points
                if stat['count'] > existing_count:
                    existing_stats[stat['month']] = stat
            else:
                existing_stats[stat['month']] = stat
        
        # Remove 'count' and 'outliers_removed' before saving
        final_stats = []
        for stat in sorted(existing_stats.values(), key=lambda x: x['month']):
            stat_copy = {k: v for k, v in stat.items() if k not in ['count', 'outliers_removed']}
            final_stats.append(stat_copy)
        historic_data[monitoring_id] = final_stats
    else:
        # Remove 'count' and 'outliers_removed' from stored data
        stats_to_store = [{k: v for k, v in stat.items() if k not in ['count', 'outliers_removed']} for stat in new_stats]
        historic_data[monitoring_id] = stats_to_store
    
    # Write back
    with open(historic_file, 'w', encoding='utf-8') as f:
        json.dump(historic_data, f, indent=2)
    
    print(f"\nUpdated {historic_file}")

def main():
    # Your API key
    API_KEY = "bqirQ15zF4kGK34QsRqlSlN0PhSUCEFB9My7cwJ1"
    YEAR = 2025
    ID = "USGS-16279200"
    
    # Split year into 4 quarters
    date_ranges = [
        (f"{YEAR}-01-01", f"{YEAR}-03-31"),  # Q1: Jan-Mar
        (f"{YEAR}-04-01", f"{YEAR}-06-30"),  # Q2: Apr-Jun
        (f"{YEAR}-07-01", f"{YEAR}-09-30"),  # Q3: Jul-Sep
        (f"{YEAR}-10-01", f"{YEAR}-12-31")   # Q4: Oct-Dec
    ]
    
    all_features = []
    
    print(f"Fetching data for {YEAR} in 4 quarters...")
    
    for i, (start, end) in enumerate(date_ranges, 1):
        print(f"\n{'='*50}")
        print(f"Quarter {i}: {start} to {end}")
        print(f"{'='*50}")
        features = fetch_usgs_data(ID, API_KEY, start, end)
        all_features.extend(features)
        print(f"  Quarter {i} total: {len(features)} features")
        time.sleep(1)  # Be nice to the API between quarters
    
    print(f"\n{'='*50}")
    print(f"Total features fetched across all quarters: {len(all_features)}")
    print(f"{'='*50}")
    
    if not all_features:
        print("No data retrieved!")
        return
    
    # Process into monthly stats
    print("\nProcessing monthly statistics...")
    monthly_data = process_features_to_monthly_stats(all_features)
    monthly_stats = calculate_monthly_stats(monthly_data)
    
    print(f"\nCalculated stats for {len(monthly_stats)} months:")
    for stat in monthly_stats:
        print(f"\n  {stat['month']}:")
        print(f"    Real average (including outliers): {stat['average']}")
        print(f"    Baseline average (outlier-adjusted): {stat['baseline_average']}")
        print(f"    Min: {stat['min']} at {stat['min_timestamp']}")
        print(f"    Max: {stat['max']} at {stat['max_timestamp']}")
        print(f"    Records: {stat['count']} (outliers removed: {stat.get('outliers_removed', 0)})")
    
    # Update historic file
    monitoring_id = "USGS-16279200"
    update_historic_data('historic-data.json', monitoring_id, monthly_stats)
    
    print("\n✅ Done! Check historic-data.json for results.")

if __name__ == "__main__":
    main()