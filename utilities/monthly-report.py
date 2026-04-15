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
    def get_time():
        timestamp = datetime.now().strftime('%H:%M:%S')
        return f"[{timestamp}]"

    """Fetch data from USGS API for a specific date range - single call only"""
    base_url = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items"
    
    # Single URL, no pagination
    url = f"{base_url}?f=json&lang=en-US&limit={limit}&properties=time,value,unit_of_measure&skipGeometry=true&sortby=%2Btime&offset={offset}&datetime={start_date}/{end_date}&monitoring_location_id={id}&api_key={api_key}&unit_of_measure=ft"
    
    print(f"{get_time()}  Fetching data for {start_date} to {end_date}...")
    
    try:
        # Create request with headers
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
        
        features = data.get('features', [])
        print(f"{get_time()}    Got {len(features)} features")
        
        return features
        
    except urllib.error.URLError as e:
        print(f"{get_time()}    Error fetching data: {e}")
        print(f"{get_time()}    URL attempted: {url[:200]}...")
        return []
    except json.JSONDecodeError as e:
        print(f"{get_time()}    Error parsing JSON: {e}")
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
    def get_time():
        timestamp = datetime.now().strftime('%H:%M:%S')
        return f"[{timestamp}]"

    """Process features into monthly data structure"""
    monthly_data: Dict[str, List[Tuple[float, str]]] = defaultdict(list)
    
    print(f"{get_time()}  Processing {len(features)} features...")
    
    for idx, feature in enumerate(features):
        if idx % 10000 == 0 and idx > 0:
            print(f"{get_time()}    Processed {idx}/{len(features)} features...")
            
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
                print(f"{get_time()}  Error parsing feature {idx}: time={time_str}, value={value_str}, error={e}")
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

def calculate_yearly_summary(monthly_stats: List[Dict], year: int, monitoring_id: str) -> Dict:
    """Calculate yearly summary from monthly statistics"""
    if not monthly_stats:
        return {}
    
    # Extract all values from monthly stats
    max_values = [stat['max'] for stat in monthly_stats]
    min_values = [stat['min'] for stat in monthly_stats]
    avg_values = [stat['average'] for stat in monthly_stats]
    baseline_values = [stat['baseline_average'] for stat in monthly_stats]
    
    # Find overall max and min with their months
    overall_max = max(max_values)
    overall_max_month = monthly_stats[max_values.index(overall_max)]['month']
    
    overall_min = min(min_values)
    overall_min_month = monthly_stats[min_values.index(overall_min)]['month']
    
    # Calculate yearly averages
    yearly_avg = round(sum(avg_values) / len(avg_values), 2)
    yearly_baseline = round(sum(baseline_values) / len(baseline_values), 2)
    
    # Find month with highest and lowest average
    highest_avg_month = monthly_stats[avg_values.index(max(avg_values))]['month']
    lowest_avg_month = monthly_stats[avg_values.index(min(avg_values))]['month']
    
    return {
        'year': year,
        'monitoring_id': monitoring_id,
        'total_months': len(monthly_stats),
        'overall_max': overall_max,
        'overall_max_month': overall_max_month,
        'overall_min': overall_min,
        'overall_min_month': overall_min_month,
        'yearly_average': yearly_avg,
        'yearly_baseline_average': yearly_baseline,
        'highest_avg_month': highest_avg_month,
        'highest_avg_value': max(avg_values),
        'lowest_avg_month': lowest_avg_month,
        'lowest_avg_value': min(avg_values),
        'monthly_data': monthly_stats  # Keep full monthly data for reference
    }

def update_historic_data(historic_file: str, monitoring_id: str, new_stats: List[Dict], yearly_summary: Dict = None):
    """Update historic-data.json with new statistics and yearly summary"""
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
    
    # Handle old data structure (if monitoring_id directly contains an array instead of a dict)
    if monitoring_id in historic_data:
        # Check if it's the old format (list) or new format (dict)
        if isinstance(historic_data[monitoring_id], list):
            # Convert old format to new format
            old_monthly_data = historic_data[monitoring_id]
            historic_data[monitoring_id] = {
                'monthly': old_monthly_data,
                'yearly_summaries': []
            }
            print(f"  Converted old data format for {monitoring_id}")
    
    # Initialize monitoring location data if it doesn't exist
    if monitoring_id not in historic_data:
        historic_data[monitoring_id] = {
            'monthly': [],
            'yearly_summaries': []
        }
    
    # Ensure the monitoring location has required keys
    if 'monthly' not in historic_data[monitoring_id]:
        historic_data[monitoring_id]['monthly'] = []
    if 'yearly_summaries' not in historic_data[monitoring_id]:
        historic_data[monitoring_id]['yearly_summaries'] = []
    
    # Merge monthly data
    existing_stats = {stat['month']: stat for stat in historic_data[monitoring_id]['monthly']}
    for stat in new_stats:
        if stat['month'] in existing_stats:
            # Keep the one with more data points if count exists
            existing_count = existing_stats[stat['month']].get('count', 0)
            new_count = stat.get('count', 0)
            if new_count > existing_count:
                # Remove count and outliers_removed before storing
                stat_to_store = {k: v for k, v in stat.items() if k not in ['count', 'outliers_removed']}
                existing_stats[stat['month']] = stat_to_store
        else:
            # Remove count and outliers_removed before storing
            stat_to_store = {k: v for k, v in stat.items() if k not in ['count', 'outliers_removed']}
            existing_stats[stat['month']] = stat_to_store
    
    historic_data[monitoring_id]['monthly'] = sorted(existing_stats.values(), key=lambda x: x['month'])
    
    # Update or add yearly summary
    if yearly_summary:
        # Remove monthly_data from yearly_summary before storing (to avoid duplication)
        yearly_summary_to_store = {k: v for k, v in yearly_summary.items() if k != 'monthly_data'}
        
        # Check if this year already exists, update if so
        year_exists = False
        for i, summary in enumerate(historic_data[monitoring_id]['yearly_summaries']):
            if summary.get('year') == yearly_summary_to_store.get('year'):
                historic_data[monitoring_id]['yearly_summaries'][i] = yearly_summary_to_store
                year_exists = True
                break
        
        if not year_exists:
            historic_data[monitoring_id]['yearly_summaries'].append(yearly_summary_to_store)
        
        # Sort yearly summaries by year
        historic_data[monitoring_id]['yearly_summaries'] = sorted(
            historic_data[monitoring_id]['yearly_summaries'], 
            key=lambda x: x['year']
        )
    
    # Write back
    with open(historic_file, 'w', encoding='utf-8') as f:
        json.dump(historic_data, f, indent=2)
    
    print(f"  Updated {historic_file}")

def main():
    # Your API key
    API_KEY = "bqirQ15zF4kGK34QsRqlSlN0PhSUCEFB9My7cwJ1"
    YEAR = 2025
    
    # Create log file with timestamp
    log_filename = f"water_data_log_{YEAR}_{datetime.now().strftime('%m-%d_%H%M%S')}.txt"
    log_file = open(log_filename, 'w', encoding='utf-8')
    
    def log_print(*args, **kwargs):
        """Print to both console and log file with timestamp"""
        # Get current time in HH:MM:SS format
        timestamp = datetime.now().strftime('%H:%M:%S')
    
        # Add timestamp to the beginning of the message
        # Convert args to a list so we can modify them
        args_with_timestamp = (f"[{timestamp}]",) + args
    
        print(*args_with_timestamp, **kwargs)
        print(*args_with_timestamp, **kwargs, file=log_file)
    
        # Ensure it writes immediately
        log_file.flush()
    
    log_print(f"Log file: {log_filename}")
    log_print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    log_print(f"{'='*60}")
    
    # Array of monitoring location IDs
    monitoring_ids = [
        "USGS-213320158061401",
        "USGS-213308158035601",
        "USGS-213133158014201",
        "USGS-16345000",
        "USGS-16330000",
        "USGS-16325000",
        "USGS-16210500",
        "USGS-16304200",
        "USGS-16301050",
        "USGS-16296500",
        "USGS-16294900",
        "USGS-16294100",
        "USGS-16284200",
        "USGS-16283200",
        "USGS-16279200",
        "USGS-16275000",
        "USGS-16274100",
        "USGS-16265000",
        "USGS-16264600",
        "USGS-16254000",
        "USGS-16249000",
        "USGS-16247100",
        "USGS-16244000",
        "USGS-16241600",
        "USGS-16240500",
        "USGS-16238500",
        "USGS-16238000",
        "USGS-16229000",
        "USGS-16227500",
        "USGS-16226700",
        "USGS-16226400",
        "USGS-16226200",
        "USGS-16247150",
        "USGS-16213000",
        "USGS-16212601",
        "USGS-16210200",
        "USGS-16210100",
        "USGS-16210000",
        "USGS-16208400",
        "USGS-16208000",
        "USGS-16206600",
        "USGS-16200000",
        "USGS-16212490",
        "USGS-16211800",
        "USGS-16211600"
    ]

    # Split year into 4 quarters
    date_ranges = [
        (f"{YEAR}-01-01", f"{YEAR}-03-31"),  # Q1: Jan-Mar
        (f"{YEAR}-04-01", f"{YEAR}-06-30"),  # Q2: Apr-Jun
        (f"{YEAR}-07-01", f"{YEAR}-09-30"),  # Q3: Jul-Sep
        (f"{YEAR}-10-01", f"{YEAR}-12-31")   # Q4: Oct-Dec
    ]
    
    total_features_all_ids = 0
    successful_ids = 0
    
    # Loop through each monitoring ID
    for idx, monitoring_id in enumerate(monitoring_ids, 1):
        log_print(f"{'#'*60}\n")
        log_print(f"# Processing monitoring location {idx}/{len(monitoring_ids)}: {monitoring_id}\n")
        log_print(f"{'#'*60}\n")
        
        all_features = []
        
        log_print(f"Fetching data for {YEAR} in 4 quarters...\n")
        
        for i, (start, end) in enumerate(date_ranges, 1):
            log_print(f"{'='*50}\n")
            log_print(f"Quarter {i}: {start} to {end}\n")
            log_print(f"{'='*50}\n")
            features = fetch_usgs_data(monitoring_id, API_KEY, start, end)
            all_features.extend(features)
            log_print(f"  Quarter {i} total: {len(features)} features\n\n")
            time.sleep(1)
        
        log_print(f"{'='*50}\n")
        log_print(f"Total features fetched for {monitoring_id}: {len(all_features)}\n")
        log_print(f"{'='*50}\n")
        
        if not all_features:
            log_print(f"No data retrieved for {monitoring_id}, skipping...")
            continue
        
        successful_ids += 1
        total_features_all_ids += len(all_features)
        
        log_print("Processing monthly statistics...")
        monthly_data = process_features_to_monthly_stats(all_features)
        monthly_stats = calculate_monthly_stats(monthly_data)
        
        # Calculate yearly summary
        yearly_summary = calculate_yearly_summary(monthly_stats, YEAR, monitoring_id)
        
        log_print(f"{'='*50}\n")
        log_print(f"YEARLY SUMMARY FOR {monitoring_id} - {YEAR}\n")
        log_print(f"{'='*50}")
        log_print(f"Total months with data: {yearly_summary['total_months']}/12")
        log_print(f"Overall Maximum: {yearly_summary['overall_max']} in {yearly_summary['overall_max_month']}")
        log_print(f"Overall Minimum: {yearly_summary['overall_min']} in {yearly_summary['overall_min_month']}")
        log_print(f"Yearly Average (real): {yearly_summary['yearly_average']}")
        log_print(f"Yearly Baseline (outlier-adjusted): {yearly_summary['yearly_baseline_average']}")
        log_print(f"Highest Monthly Average: {yearly_summary['highest_avg_value']} in {yearly_summary['highest_avg_month']}")
        log_print(f"Lowest Monthly Average: {yearly_summary['lowest_avg_value']} in {yearly_summary['lowest_avg_month']}\n")
        log_print(f"{'='*50}\n\n")
        
        log_print(f"Detailed monthly stats:")
        for stat in monthly_stats:
            log_print(f"  {stat['month']}:")
            log_print(f"    Real average: {stat['average']}")
            log_print(f"    Baseline average: {stat['baseline_average']}")
            log_print(f"    Min: {stat['min']} at {stat['min_timestamp']}")
            log_print(f"    Max: {stat['max']} at {stat['max_timestamp']}")
            log_print(f"    Records: {stat['count']} (outliers removed: {stat.get('outliers_removed', 0)})\n")
        
        update_historic_data('../json/historic-data.json', monitoring_id, monthly_stats, yearly_summary)
        log_print(f"✅ Done processing {monitoring_id}!\n")
        
        if monitoring_id != monitoring_ids[-1]:
            log_print("Sleeping 10s")
            time.sleep(10)
    
    # Print summary
    log_print(f"{'#'*60}\n")
    log_print(f"# PROCESSING COMPLETE\n")
    log_print(f"{'#'*60}\n")
    log_print(f"Total monitoring IDs processed: {len(monitoring_ids)}")
    log_print(f"Successful IDs: {successful_ids}")
    log_print(f"Total features fetched across all IDs: {total_features_all_ids}")
    log_print(f"Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log_print(f"Log file saved as: {log_filename}\n")
    log_print(f"{'#'*60}")
    
    log_file.close()

if __name__ == "__main__":
    main()