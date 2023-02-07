var Settings = {
	APIKey: "AIzaSyC-lQV_Sya8DMWU3CT9jEirjKDbjNC4UIU",
	DisplayStopsEmailLink: true
}

//Loading functions
function LoadMoreJS(url) {
	var js = document.createElement("script");
	js.type = "text/javascript";
	js.src = url;
	document.head.appendChild(js);
}

function SaveGTFSCache(){
	window.localStorage.setItem("GTFSCache", JSON.stringify({
		"Routes": Routes,
		"RoutesPath": RoutesPath,
		"Stops": Stops
	}));
}

function StartGTFSLoad(loaded_from_cache){
	LoadedFromCache = loaded_from_cache;
	
	Calendar = false;
	PositiveCalendarDates = false;
	NegativeCalendarDates = false;
	Routes = false;
	StopTimes = false;
	Stops = false;
	Trips = false;
	
	Polylines = false;
	StopMarkers = false;
	VisibleRoutes = [];
}

function CheckIfGTFSLoaded(){
	if(LoadedFromCache){
		if(Routes &&
			RoutesPath &&
			Stops &&
			MapsAPI){
			OnGTFSLoad();
		}
	}
	else{
		if(Calendar &&
			PositiveCalendarDates &&
			NegativeCalendarDates &&
			Routes &&
			StopTimes &&
			Stops &&
			Trips &&
			MapsAPI){
			OnGTFSLoad();
		}
	}
}

function OnGTFSLoad(){
	if(!LoadedFromCache){
		FillRoutesPath();
		
		SaveGTFSCache();
		
		document.getElementById("dateselector").style.display = "";
		
		document.getElementById("uploadedcontainer").style.display = "none";
	}
	
	AddStopsToMap();
	AddRoutesToMap();
	
	AddRoutesToDetailsTab();
}

function MapsAPICallback(){
	MapsAPI = new google.maps.Map(document.getElementById("map"), {
		zoom: 13,
		center: {lat: 38.7340506, lng: -9.1350641},
		mapTypeId: "satellite"
	});
	
	CheckIfGTFSLoaded();
}
//So closure compiler doesn't rename this function: https://developers.google.com/closure/compiler/docs/api-tutorial3#export
window['MapsAPICallback'] = MapsAPICallback;

function AddStopsToMap(){
	StopMarkers = {};
	
	for(var stop_id in Stops){
		if(Stops.hasOwnProperty(stop_id)){
			var marker = new google.maps.Marker({
				position: {lat: Stops[stop_id]['Lat'], lng: Stops[stop_id]['Long']},
				map: MapsAPI,
				title: Stops[stop_id]['Name'],
				zIndex: 1
			});
			marker.addListener("click", StopClicked);
			
			StopMarkers[stop_id] = marker;
		}
	}
}

function AddRoutesToMap(){
	Polylines = {};
	
	for(var route_id in RoutesPath){
		var route_coordinates = [],
			i = 0,
			n = RoutesPath[route_id].length;
		while(i != n){
			var stop_id = RoutesPath[route_id][i];
			route_coordinates.push({lat: Stops[stop_id]['Lat'], lng: Stops[stop_id]['Long']});
			
			i++;
		}
		
		Polylines[route_id] = new google.maps.Polyline({
			path: route_coordinates,
			geodesic: true,
			strokeOpacity: 1.0,
			strokeWeight: 5,
			map: MapsAPI,
			visible: false
		});
	}
}

function AddRoutesToDetailsTab(){
	var routes_list_html = '',
		i = 0;
	for(var route_id in Routes){
		if(Routes.hasOwnProperty(route_id)){
			routes_list_html += '<li><input id="routecheckbox' + i + '" class="routecheckbox" type="checkbox" data-routeid="' + route_id + '" /><span class="routecolor"></span><label class="routename" for="routecheckbox' + i + '">' + Routes[route_id] + '</label></li>';
			
			i++;
		}
	}
	
	document.getElementById("routeslist").innerHTML = routes_list_html;
	
	var elem = document.getElementById("routeslist").firstChild;
	while(elem){
		elem.addEventListener("change", RouteCheckboxClicked, false);
		elem = elem.nextSibling;
	}
}

function FillRoutesPath(){
	RoutesPath = {};
	
	var sample_trip_of_routes = {},
		sample_trip_ids = [],
		sample_trips_stops_and_departure_times = {};
	for(var trip_id in Trips){
		if(Trips.hasOwnProperty(trip_id)){
			if(!(Trips[trip_id]['RouteID'] in sample_trip_of_routes)){
				sample_trip_of_routes[Trips[trip_id]['RouteID']] = trip_id;
				sample_trip_ids.push(trip_id);
				sample_trips_stops_and_departure_times[trip_id] = [];
			}
		}
	}
	
	for(var stop_id in StopTimes){
		if(StopTimes.hasOwnProperty(stop_id)){
			var i = 0,
				n = StopTimes[stop_id]['TripIDs'].length;
			while(i != n){
				if(sample_trip_ids.indexOf(StopTimes[stop_id]['TripIDs'][i]) != -1){
					sample_trips_stops_and_departure_times[StopTimes[stop_id]['TripIDs'][i]].push([stop_id, StopTimes[stop_id]['DepartureTimes'][i]]);
				}
				i++;
			}
		}
	}
	
	for(var trip_id in sample_trips_stops_and_departure_times){
		if(sample_trips_stops_and_departure_times.hasOwnProperty(trip_id)){
			sample_trips_stops_and_departure_times[trip_id].sort(function(left, right){
				return left[1] < right[1] ? -1 : 1;
			});
		}
	}
	
	for(var route_id in sample_trip_of_routes){
		if(sample_trip_of_routes.hasOwnProperty(route_id)){
			RoutesPath[route_id] = [];
			
			var trip_id = sample_trip_of_routes[route_id],
				i = 0,
				n = sample_trips_stops_and_departure_times[trip_id].length;
			while(i != n){
				var stop_id = sample_trips_stops_and_departure_times[trip_id][i][0];
				
				RoutesPath[route_id].push(stop_id);
				
				i++;
			}
		}
	}
}

//Map interaction functions
function GetStopFromLatLng(lat, lng){
	var smallest_difference_in_coordinates = 1;
	var closest_stop_id = false;
	for(var stop_id in Stops){
		if(Stops.hasOwnProperty(stop_id)){
			var difference_in_coordinates = Math.abs(Stops[stop_id]['Lat'] - lat) + Math.abs(Stops[stop_id]['Long'] - lng);
			if(difference_in_coordinates < smallest_difference_in_coordinates){
				smallest_difference_in_coordinates = difference_in_coordinates;
				closest_stop_id = stop_id;
			}
			/*if(latLng.equals(new google.maps.LatLng(Stops[stop_id]['Lat'], Stops[stop_id]['Long']))){
				return stop_id;
			}*/
		}
	}
	return closest_stop_id;
}

function StopClicked(event){
	document.getElementById("uploadedcontainer").style.display = "none";
	
	var stop_id = GetStopFromLatLng(event['latLng'].lat(), event['latLng'].lng());
	
	if(stop_id){
		document.getElementById("stopname").innerText = Stops[stop_id]['Name'];
		
		document.getElementById("departuretimes").style.display = "";
		
		SetStopDetails(stop_id);
	}
	else{
		console.log("Stop not found");
	}
}

//Stop details functions
function SetStopDetails(stop_id){
	CurrentStopID = stop_id;
	
	var route_ids = [];
		
	for(var route_id in RoutesPath){
		if(RoutesPath.hasOwnProperty(route_id)){
			if(RoutesPath[route_id].indexOf(stop_id) != -1){
				route_ids.push(route_id);
			}
		}
	}
	
	var routes_possible_colors = GetColors(route_ids.length),
		routes_color = {},
		elem = document.getElementById("routeslist").firstChild;
	while(elem){
		var route_id = elem.childNodes[0].dataset['routeid'],
			route_id_index = route_ids.indexOf(route_id);
		if(route_id_index == -1){
			elem.style.display = "none";
		}
		else{
			routes_color[route_id] = routes_possible_colors[route_id_index];
			Polylines[route_id].setOptions({strokeColor: routes_possible_colors[route_id_index]});
			
			elem.style.display = "";
			elem.childNodes[0].checked = true;
			elem.childNodes[1].style.backgroundColor = routes_possible_colors[route_id_index];
		}
		
		elem = elem.nextSibling;
	}
	
	if(Settings.DisplayStopsEmailLink){
		var stop_id_for_email = stop_id.split("_")[1],
			complete_stop_id_for_email = ("00000" + stop_id_for_email).substring(stop_id_for_email.length);
		document.getElementById("scheduleemaillink").href = "mailto:sms@carris.pt?subject=C " + complete_stop_id_for_email;
	}
	
	VisibleRoutes = route_ids;
	SetRoutesVisibility();
	
	if(!LoadedFromCache){
		if(stop_id in StopTimes){
			var stop_times_obj = StopTimes[stop_id],
				current_date = document.getElementById("dateselector").valueAsDate,
				current_date_integer = current_date.getFullYear() * 10000 + (current_date.getMonth() + 1) * 100 + current_date.getDate(),
				current_weekday_to_power_10_to = 7 - current_date.getDay(),
				is_available_in_current_date,
				trips_sorted_by_departure_time = [],
				i = 0,
				n = stop_times_obj['TripIDs'].length;
			while(i != n){
				var service_id = Trips[stop_times_obj['TripIDs'][i]]['ServiceID'];
				
				if(service_id in PositiveCalendarDates && PositiveCalendarDates[service_id].indexOf(current_date_integer) != -1){
					is_available_in_current_date = true;
				}
				else if(service_id in NegativeCalendarDates && NegativeCalendarDates[service_id].indexOf(current_date_integer) != -1){
					is_available_in_current_date = false;
				}
				else{
					if(current_date_integer >= Calendar[service_id]['StartDate'] && current_date_integer <= Calendar[service_id]['EndDate']){
						if(Math.floor((Calendar[service_id]['WeekDays'] % Math.pow(10, current_weekday_to_power_10_to)) / Math.pow(10, current_weekday_to_power_10_to - 1))){
							is_available_in_current_date = true;
						}
						else{
							is_available_in_current_date = false;
						}
					}
					else{
						is_available_in_current_date = false;
					}
				}
				
				if(is_available_in_current_date){
					trips_sorted_by_departure_time.push([stop_times_obj['TripIDs'][i], stop_times_obj['DepartureTimes'][i]]);
				}
				
				i++;
			}
			
			trips_sorted_by_departure_time.sort(function(left, right){
				return left[1] < right[1] ? -1 : 1;
			});
			
			var trips_list_html = '';
			i = 0;
			n = trips_sorted_by_departure_time.length;
			while(i != n){
				var route_id = Trips[trips_sorted_by_departure_time[i][0]]['RouteID'];
				
				trips_list_html += '<li data-tripid="' + trips_sorted_by_departure_time[i][0] + '" style="color: ' + routes_color[route_id] + ';">' + TimestampToTime(trips_sorted_by_departure_time[i][1]) + ' - ' + Routes[route_id] + '</li>';
				i++;
			}
			
			if(n == 0){
				document.getElementById("tripslist").innerHTML = "No trips";
			}
			else{
				document.getElementById("tripslist").innerHTML = trips_list_html;
			}
		}
		else{
			document.getElementById("tripslist").innerHTML = "No trips";
		}
	}
}

function RouteCheckboxClicked(event){
	if(event.target.checked){
		if(VisibleRoutes.indexOf(event.target.dataset['routeid']) == -1){
			VisibleRoutes.push(event.target.dataset.routeid);
		}
	}
	else{
		var index = VisibleRoutes.indexOf(event.target.dataset['routeid']);
		if(index != -1){
			VisibleRoutes.splice(index, 1);
		}
	}
	SetRoutesVisibility();
	
	var elem = document.getElementById("tripslist").firstChild;
	while(elem){
		var route_id = Trips[elem.dataset['tripid']]['RouteID'];
		if(VisibleRoutes.indexOf(route_id) == -1){
			elem.style.display = "none";
		}
		else{
			elem.style.display = "";
		}
		
		elem = elem.nextSibling;
	}
}

function SetRoutesVisibility(){
	for(var route_id in Polylines){
		if(Polylines.hasOwnProperty(route_id)){
			if(VisibleRoutes.indexOf(route_id) == -1){
				Polylines[route_id].setVisible(false);
			}
			else{
				Polylines[route_id].setVisible(true);
			}
		}
	}
	
	if(document.getElementById("departuretimes").style.display != "none" && document.getElementById("hidestops").checked){
		var visible_stop_ids = [],
			i = 0,
			n = VisibleRoutes.length;
		while(i != n){
			if(VisibleRoutes[i] in RoutesPath){
				var ii = 0,
					nn = RoutesPath[VisibleRoutes[i]].length;
				while(ii != nn){
					if(visible_stop_ids.indexOf(RoutesPath[VisibleRoutes[i]][ii]) == -1){
						visible_stop_ids.push(RoutesPath[VisibleRoutes[i]][ii]);
					}
					ii++;
				}
			}
			i++;
		}
		
		for(var stop_id in StopMarkers){
			if(StopMarkers.hasOwnProperty(stop_id)){
				if(visible_stop_ids.indexOf(stop_id) == -1){
					StopMarkers[stop_id].setVisible(false);
				}
				else{
					StopMarkers[stop_id].setVisible(true);
				}
			}
		}
	}
	else{
		for(var stop_id in StopMarkers){
			if(StopMarkers.hasOwnProperty(stop_id)){
				StopMarkers[stop_id].setVisible(true);
			}
		}
	}
}

//Helper functions
function TimeToTimestamp(timestring) {
	var array = timestring.split(":"),
		timestamp = parseInt(array[0], 10) * 3600 + parseInt(array[1], 10) * 60 + parseInt(array[2], 10);
	return timestamp;
}

function TimestampToTime(timestamp) {
	var hours = Math.floor(timestamp / 3600),
		minutes = Math.floor((timestamp % 3600) / 60),
		seconds = timestamp % 60;
	
	if(hours < 10){
		hours = "0" + hours;
	}
	if(minutes < 10){
		minutes = "0" + minutes;
	}
	if(seconds < 10){
		seconds = "0" + seconds;
	}
	
	return hours + ":" + minutes + ":" + seconds;
}

function VariableNamesToLoadingName(variable_name){
	return variable_name.replace(/\s/g, "").toLowerCase() + "loading";
}

function GetColors(number_of_colors){
	var colors = [],
		i = 0;
	while(i != number_of_colors){
		colors.push(360 * (i / number_of_colors));
		i++;
	}
	
	/*var current_index = number_of_colors,
		temporary_value,
		random_index;
	
	while(0 !== current_index){
		random_index = Math.floor(Math.random() * current_index);
		current_index -= 1;
		
		temporary_value = colors[current_index];
		colors[current_index] = colors[random_index];
		colors[random_index] = temporary_value;
	}*/
	
	i = 0;
	while(i != number_of_colors){
		colors[i] = "hsl(" + colors[i] + ", 100%, 50%)";
		i++;
	}
	
	return colors;
}

var LoadedFromCache = null;
var CurrentStopID = false;

var Polylines = false;
var StopMarkers = false;

var MapsAPI = false;
var VisibleRoutes = [];
var RoutesPath = [];

var Calendar = {};
var PositiveCalendarDates = {};
var NegativeCalendarDates = {};
var Routes = {};
var StopTimes = {};
var Stops = {};
var Trips = {};

(function(){
	LoadMoreJS("https://maps.googleapis.com/maps/api/js?key="+Settings.APIKey+"&callback=MapsAPICallback");
	LoadMoreJS("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.3/jszip.min.js");
	
	document.body.innerHTML = '<div id="map"></div><div id="uploadedcontainer"><input type="file" id="uploader"></div><div id="departuretimes" style="display:none;"><div id="stopheadingdiv"><h1 id="stopname"></h1><button id="closestopbutton"></button></div><div id="optionscontainer"><input id="dateselector" type="date" style="display:none;" /><label id="hidestopslabel" for="hidestops">Hide stops of hidden routes</label><input id="hidestops" type="checkbox" /><a id="scheduleemaillink" target="_blank">Send email</a></div><div id="routesandtripscontainer"><div id="routeslistcontainer"><ol id="routeslist"></ol></div><div id="tripslistcontainer"><ol id="tripslist"></ol></div></div></div>';
	document.head.insertAdjacentHTML("afterbegin", '<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"><link rel="stylesheet" href="main.css">');
	
	document.getElementById("dateselector").valueAsDate = new Date();
	
	document.getElementById("dateselector").addEventListener("change", function(){
		if(CurrentStopID){
			SetStopDetails(CurrentStopID);
		}
	}, false);
	
	document.getElementById("hidestops").addEventListener("change", function(){
		SetRoutesVisibility();
	}, false);
	
	if(!Settings.DisplayStopsEmailLink){
		document.getElementById("scheduleemaillink").display = "none";
	}
	
	document.getElementById("closestopbutton").addEventListener("click", function(){
		document.getElementById("departuretimes").style.display = "none";
		VisibleRoutes = [];
		SetRoutesVisibility();
	}, false);
	
	var GTFSCacheString = window.localStorage.getItem("GTFSCache");
	
	if(GTFSCacheString != null){
		var GTFSCache = JSON.parse(GTFSCacheString);
		
		StartGTFSLoad(true);
		
		Routes = GTFSCache['Routes'];
		RoutesPath = GTFSCache['RoutesPath'];
		Stops = GTFSCache['Stops'];
		
		CheckIfGTFSLoaded();
	}
	
	document.getElementById("uploader").addEventListener("change", function(event){
		StartGTFSLoad(false);
		
		var GTFSVariableNames = ["Calendar", "PositiveCalendarDates", "NegativeCalendarDates", "Routes", "StopTimes", "Stops", "Trips"];
		var i = 0,
			n = GTFSVariableNames.length,
			loading_html = '<ul id="loadinglist">';
		while(i != n){
			loading_html += '<li id="' + VariableNamesToLoadingName(GTFSVariableNames[i]) + '" class="loadinglistelement">Loading ' + GTFSVariableNames[i] + '...</li>';
			i++;
		}
		loading_html += '</ul>';
		document.getElementById("uploadedcontainer").insertAdjacentHTML("beforeend", loading_html);
		
		var filereader = new FileReader();
		
		filereader.addEventListener("load", function(event){
			document.getElementById("uploader").style.display = "none";
			var promise = new JSZip().loadAsync(event.target.result);
			
			promise.then(function(GTFSzip){
				GTFSzip.file("calendar.txt").async("string").then(function(content){
					Calendar = {};
					
					var lines = content.match(/[^\r\n]+/g),
						field_names_line = lines[0].split(","),
						service_id_index = field_names_line.indexOf("service_id"),
						sunday_index = field_names_line.indexOf("sunday"),
						monday_index = field_names_line.indexOf("monday"),
						tuesday_index = field_names_line.indexOf("tuesday"),
						wednesday_index = field_names_line.indexOf("wednesday"),
						thursday_index = field_names_line.indexOf("thursday"),
						friday_index = field_names_line.indexOf("friday"),
						saturday_index = field_names_line.indexOf("saturday"),
						start_date_index = field_names_line.indexOf("start_date"),
						end_date_index = field_names_line.indexOf("end_date"),
						i = 1,
						n = lines.length;
					while(i != n){
						var parts_of_line = lines[i].split(","),
							service_id = parts_of_line[service_id_index],
							sunday = parseInt(parts_of_line[sunday_index], 10),
							monday = parseInt(parts_of_line[monday_index], 10),
							tuesday = parseInt(parts_of_line[tuesday_index], 10),
							wednesday = parseInt(parts_of_line[wednesday_index], 10),
							thursday = parseInt(parts_of_line[thursday_index], 10),
							friday = parseInt(parts_of_line[friday_index], 10),
							saturday = parseInt(parts_of_line[saturday_index], 10);
						Calendar[service_id] = {
							"WeekDays": sunday * 1000000 + monday * 100000 + tuesday * 10000 + wednesday * 1000 + thursday * 100 + friday * 10 + saturday,
							"StartDate": parseInt(parts_of_line[start_date_index], 10),
							"EndDate": parseInt(parts_of_line[end_date_index], 10)
						};
						i++;
					}
					document.getElementById(VariableNamesToLoadingName("Calendar")).style.display = "none";
					CheckIfGTFSLoaded();
				}, function(){
					console.log("Error loading calendar.txt file");
				});
				
				GTFSzip.file("calendar_dates.txt").async("string").then(function(content){
					PositiveCalendarDates = {};
					NegativeCalendarDates = {};
					
					var lines = content.match(/[^\r\n]+/g),
						field_names_line = lines[0].split(","),
						service_id_index = field_names_line.indexOf("service_id"),
						date_index = field_names_line.indexOf("date"),
						exception_type_index = field_names_line.indexOf("exception_type"),
						i = 1,
						n = lines.length;
					while(i != n){
						var parts_of_line = lines[i].split(","),
							service_id = parts_of_line[service_id_index],
							date = parseInt(parts_of_line[date_index], 10);
						if(parts_of_line[exception_type_index] == "1"){
							if(!(service_id in PositiveCalendarDates)){
								PositiveCalendarDates[service_id] = [];
							}
							PositiveCalendarDates[service_id].push(date);
						}
						else if(parts_of_line[exception_type_index] == "2"){
							if(!(service_id in NegativeCalendarDates)){
								NegativeCalendarDates[service_id] = [];
							}
							NegativeCalendarDates[service_id].push(date);
						}
						i++;
					}
					document.getElementById(VariableNamesToLoadingName("PositiveCalendarDates")).style.display = "none";
					document.getElementById(VariableNamesToLoadingName("NegativeCalendarDates")).style.display = "none";
					CheckIfGTFSLoaded();
				}, function(){
					console.log("Error loading calendar_dates.txt file");
				});
				
				GTFSzip.file("routes.txt").async("string").then(function(content){
					Routes = {};
					
					var lines = content.match(/[^\r\n]+/g),
						field_names_line = lines[0].split(","),
						route_id_index = field_names_line.indexOf("route_id"),
						route_long_name_index = field_names_line.indexOf("route_long_name"),
						i = 1,
						n = lines.length;
					while(i != n){
						var parts_of_line = lines[i].split(","),
							route_id = parts_of_line[route_id_index],
							route_long_name = parts_of_line[route_long_name_index];
						Routes[route_id] = route_long_name;
						i++;
					}
					document.getElementById(VariableNamesToLoadingName("Routes")).style.display = "none";
					CheckIfGTFSLoaded();
				}, function(){
					console.log("Error loading routes.txt file");
				});
				
				GTFSzip.file("stop_times.txt").async("string").then(function(content){
					StopTimes = {};
					
					var lines = content.match(/[^\r\n]+/g),
						field_names_line = lines[0].split(","),
						trip_id_index = field_names_line.indexOf("trip_id"),
						departure_time_index = field_names_line.indexOf("departure_time"),
						stop_id_index = field_names_line.indexOf("stop_id"),
						i = 1,
						n = lines.length;
					while(i != n){
						var parts_of_line = lines[i].split(","),
							stop_id = parts_of_line[stop_id_index];
						if(!(stop_id in StopTimes)){
							StopTimes[stop_id] = {"TripIDs": [], "DepartureTimes": []};
						}
						StopTimes[stop_id]['TripIDs'].push(parts_of_line[trip_id_index]);
						StopTimes[stop_id]['DepartureTimes'].push(TimeToTimestamp(parts_of_line[departure_time_index]));
						i++;
					}
					document.getElementById(VariableNamesToLoadingName("StopTimes")).style.display = "none";
					CheckIfGTFSLoaded();
				}, function(){
					console.log("Error loading stops.txt file");
				});
				
				GTFSzip.file("stops.txt").async("string").then(function(content){
					Stops = {};
					
					var lines = content.match(/[^\r\n]+/g),
						field_names_line = lines[0].split(","),
						stop_id_index = field_names_line.indexOf("stop_id"),
						stop_name_index = field_names_line.indexOf("stop_name"),
						stop_lat_index = field_names_line.indexOf("stop_lat"),
						stop_lon_index = field_names_line.indexOf("stop_lon"),
						parts_of_line,
						i = 1,
						n = lines.length;
					while(i != n){
						parts_of_line = lines[i].split(",");
						Stops[parts_of_line[stop_id_index]] = {
							"Name": parts_of_line[stop_name_index],
							"Lat": parseFloat(parts_of_line[stop_lat_index]),
							"Long": parseFloat(parts_of_line[stop_lon_index])
						};
						i++;
					}
					document.getElementById(VariableNamesToLoadingName("Stops")).style.display = "none";
					CheckIfGTFSLoaded();
				}, function(){
					console.log("Error loading stops.txt file");
				});
				
				GTFSzip.file("trips.txt").async("string").then(function(content){
					Trips = {};
					
					var lines = content.match(/[^\r\n]+/g),
						field_names_line = lines[0].split(","),
						route_id_index = field_names_line.indexOf("route_id"),
						service_id_index = field_names_line.indexOf("service_id"),
						trip_id_index = field_names_line.indexOf("trip_id"),
						shape_id_index = field_names_line.indexOf("shape_id"),
						i = 1,
						n = lines.length;
					while(i != n){
						var parts_of_line = lines[i].split(","),
							trip_id = parts_of_line[trip_id_index];
						Trips[trip_id] = {"RouteID": parts_of_line[route_id_index], "ServiceID": parts_of_line[service_id_index], "shape_id": parts_of_line[shape_id_index]}
						i++;
					}
					document.getElementById(VariableNamesToLoadingName("Trips")).style.display = "none";
					CheckIfGTFSLoaded();
				}, function(){
					console.log("Error loading trips.txt file");
				});
			}, function(){
				console.log("Error loading GTFS zip file");
			});
		}, false);
		
		filereader.readAsBinaryString(event.target.files[0]);
	}, false);
}());