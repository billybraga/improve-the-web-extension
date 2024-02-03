if (!window.__itwLoaded) {
    window.__itwLoaded = true;

    console.log("ra");

    const tbody = document.querySelector("form table tbody");
    const promoCheckbox = document.getElementById('Accessories_Winter');

    if (promoCheckbox) {
        promoCheckbox.checked = true;
    }

    if (tbody && document.querySelector('input[type=hidden][name=NbrStation]') && document.querySelector("#ShowMap")?.value !== 'True') {
        loadResults();
    }

    const berriUqamName = "Berri-Uqam";
    const preferredModels = {
        Carnival: true,
        Elantra: true,
        Kicks: true,
        Kona: true,
        Sorento: true,
        Sportage: true,
        Tucson: true,
        Venue: true,
    };

    const montrealPoly = [
        createLatLng(-73.4439468, 45.7167284),
        createLatLng(-73.5444031, 45.5063027),
        createLatLng(-73.5397339, 45.4755719),
        createLatLng(-73.6186981, 45.4160848),
        createLatLng(-73.8435745, 45.5104643),
        createLatLng(-73.7649536, 45.5099832),
        createLatLng(-73.6839294, 45.5496624),
        createLatLng(-73.6262512, 45.6296570),
        createLatLng(-73.5163879, 45.6989852)
    ];

    async function loadResults() {
        const strStartDate = document.querySelector('[name=StartDay]').value + '/' + document.querySelector('[name=StartMonth]').value + '/' + document.querySelector('[name=StartYear]').value + ' ' + document.querySelector('[name=StartHour]').value + ':' + document.querySelector('[name=StartMinute]').value + ':00';
        const strEndDate = document.querySelector('[name=EndDay]').value + '/' + document.querySelector('[name=EndMonth]').value + '/' + document.querySelector('[name=EndYear]').value + ' ' + document.querySelector('[name=EndHour]').value + ':' + document.querySelector('[name=EndMinute]').value + ':00';

        const callbackName = "jsonp";
        const afToken = document.querySelector("[name=AntiForgeryToken]").value;
        const bodyUrl = new URLSearchParams({
            CurrentLanguageID: 1,
            CityID: 59,
            StartDate: strStartDate,
            EndDate: strEndDate,
            Accessories: 0,
            Brand: "",
            FeeType: 80,
            Latitude: 45.5157665,
            Longitude: -73.5569469
        });

        const response = await fetch(`https://www.reservauto.net/Scripts/Client/Ajax/Reservations/Get_Car_Disponibility.asp?callback=${callbackName}`, {
            "headers": {
                "antiforgerytoken": afToken,
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
            },
            "body": bodyUrl.toString(),
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        });

        const content = await response.text();
        /** @var {{data: Array}} result */
        const result = JSON.parse(
            content
                .substring(callbackName.length + 1, content.length - 1)
                .replaceAll(
                    /([{,])(StationID|StationNo|Longitude|Latitude|Distance|strNomStation|CarID|CarNo|NbrRes|Accessories|lngModel|Brand|Model|Color|HTMLAccessories|CityID):/g,
                    (part, separator, name) => `${separator}"${name}":`
                )
        );

        const inMontreal = result.data.filter(x => isPointInPolygon({lat: x.Latitude, lng: x.Longitude}, montrealPoly));
        const inMontrealAndAvailable = inMontreal.filter(x => x.NbrRes === 0, montrealPoly);

        console.log("inMontrealAndAvailable", inMontrealAndAvailable);

        inMontrealAndAvailable.forEach(x => updateDistance(x));
        inMontrealAndAvailable.sort((a, b) => a.time - b.time);

        let hasThatPreferredModel = {};
        let hasPromoVehicle = false;
        
        for (let i = 0; i < inMontrealAndAvailable.length; i++) {
            const formatCar = (description) => {
                const time = Math.round(car.time) + " min";
                return `#${i + 1}, ${time}: ${description} (${car.directions})`;
            }

            const car = inMontrealAndAvailable[i];
            const isPreferredModel = preferredModels[car.Model] === true;
            const isPromoVehicle = car.HTMLAccessories.indexOf("PROMO") !== -1;
            const href = document.querySelector(`a[href*="StationID=${car.StationID}\'"]`);
            const row = href?.parentElement?.parentElement;
            let color = null;
            if (i === 0) {
                color = "#bbffbb";
            } else if (i === 1) {
                color = "#ebeb98";
            } else if (i === 3) {
                color = "#ffcccc";
            } else if (isPreferredModel) {
                color = "#bbeeee";
            } else if (isPromoVehicle) {
                color = "#aaddaa";
            }
            if (href) {
                href.textContent = formatCar(href.textContent);
                if (color) {
                    row.style.backgroundColor = color;
                }
            } else if (i < 3 || (isPreferredModel && !hasThatPreferredModel[car.Model]) || (isPromoVehicle && !hasPromoVehicle)) {
                const newRow = document.createElement("tr");
                newRow.innerHTML = `
                    <td width="40"><img src="../../Images/Clients/Spacer.gif" width="38" height="30"></td>
                    <td width="300" class="">
                        <a href="javascript:newWin ('InfoStation.asp?CurrentLanguageID=2&amp;StationID=${car.StationID}', 440, 550, -1, -1)">${formatCar(car.StationNo + " - " + car.strNomStation)}</a>
                    </td>
                    <td width="40" align="center" class="">
                        <a href="javascript:BillingRulesAcpt(59, false, ${car.Longitude}, ${car.Latitude}, ${car.CarID});">Select</a>
                    </td>
                    <td width="420" align="center" class="">
                        <font face="Arial, Helvetica, sans-serif" size="1">
                            ${car.Brand} - ${car.Model}                        
                            ${car.HTMLAccessories}
                        </font>
                    </td>`;
                if (color) {
                    newRow.style.backgroundColor = color;
                }
                tbody.appendChild(newRow);
            }
            hasThatPreferredModel[car.Model] = isPreferredModel;
            hasPromoVehicle ||= isPromoVehicle;
        }

        const badCells = document.querySelectorAll("form table tbody tr td.greySpecial");
        for (const badCell of badCells) {
            badCell.classList.remove("greySpecial");
        }
    }

    function getLongitude(point) {
        return point.lng;
    }

    function getLatitude(point) {
        return point.lat;
    }

    function isPointInPolygon(point, polygon) {
        let isInside = false;
        const totalPolys = polygon.length;
        for (let i = -1, j = totalPolys - 1; ++i < totalPolys; j = i) {
            if (
                ((getLongitude(polygon[i]) <= getLongitude(point) &&
                        getLongitude(point) < getLongitude(polygon[j])) ||
                    (getLongitude(polygon[j]) <= getLongitude(point) &&
                        getLongitude(point) < getLongitude(polygon[i]))) &&
                getLatitude(point) <
                ((getLatitude(polygon[j]) - getLatitude(polygon[i])) *
                    (getLongitude(point) - getLongitude(polygon[i]))) /
                (getLongitude(polygon[j]) - getLongitude(polygon[i])) +
                getLatitude(polygon[i])
            ) {
                isInside = !isInside;
            }
        }

        return isInside;
    }

    function createLatLng(lng, lat) {
        return {lat, lng};
    }

    function updateDistance(carStation) {
        const carStationPoint = {lat: carStation.Latitude, lng: carStation.Longitude};
        carStation.closestMetroStation = metroLines
            .flatMap(x => x.stations)
            .map(metroStation => {
                const distanceMeters = pointDistance(metroStation, carStationPoint);
                return {
                    distanceMeters,
                    metroStation
                };
            })
            .reduce((p, v) => p?.distanceMeters < v.distanceMeters ? p : v);

        const timeToPreferredStation = 5;
        const carBackTime = distanceToTimeMinutes(carStation.Distance, 20);
        const walkingTime = distanceToTimeMinutes(carStation.Distance, 6);
        const walkTime = walkingTime + carBackTime;
        const inMetroTime = carStation.closestMetroStation.metroStation.stationDistance * 1.5;
        const toCarFromMetroTime = carStation.closestMetroStation.distanceMeters / 100;
        const metroTime = timeToPreferredStation
            + inMetroTime
            + toCarFromMetroTime
            + carBackTime;
        if (walkTime < metroTime) {
            carStation.directions = `${walkingTime.toFixed(1)} min à pied, ${carBackTime.toFixed(1)} min to home`;
            carStation.time = walkTime
        } else {
            carStation.directions = `${timeToPreferredStation.toFixed(1)} min to Berri-UQAM, ${inMetroTime.toFixed(1)} min to ${carStation.closestMetroStation.metroStation.name}, ${toCarFromMetroTime.toFixed(1)} min to car, ${carBackTime.toFixed(1)} min to home`;
            carStation.time = metroTime;
        }
    }

    function distanceToTimeMinutes(distanceKm, speedKmh) {
        return 60 * (distanceKm / speedKmh);
    }

    function pointDistance(point1, point2) {
        const R = 6378.137; // Radius of earth in KM
        const dLat = point2.lat * Math.PI / 180 - point1.lat * Math.PI / 180;
        const dLon = point2.lng * Math.PI / 180 - point1.lng * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c;
        return d * 1000; // meters
    }

    const metroLines = [
        {
            name: "verte",
            stations: [{
                "name": "Honoré-Beaugrand",
                "lat": 45.59657199905219,
                "lng": -73.5353760000001
            }, {
                "name": "Radisson",
                "lat": 45.5894309990522,
                "lng": -73.5392690000001
            }, {
                "name": "Langelier",
                "lat": 45.58273599905217,
                "lng": -73.5431330000001
            }, {
                "name": "Cadillac",
                "lat": 45.57684299905218,
                "lng": -73.5467100000001
            }, {
                "name": "Assomption",
                "lat": 45.56928499905219,
                "lng": -73.5473360000001
            }, {
                "name": "Viau",
                "lat": 45.56068699905216,
                "lng": -73.5475300000001
            }, {
                "name": "Pie-IX",
                "lat": 45.553687999052144,
                "lng": -73.5517570000001
            }, {
                "name": "Joliette",
                "lat": 45.54683199905216,
                "lng": -73.5513910000001
            }, {
                "name": "Préfontaine",
                "lat": 45.541716999052134,
                "lng": -73.5541920000001
            }, {
                "name": "Frontenac",
                "lat": 45.53350399905215,
                "lng": -73.5521960000001
            }, {
                "name": "Papineau",
                "lat": 45.52398799905213,
                "lng": -73.5527030000001
            }, {
                "name": "Beaudry",
                "lat": 45.51883099905213,
                "lng": -73.5558370000001
            }, {
                "name": berriUqamName,
                "lat": 45.51522599905212,
                "lng": -73.5610820000001
            }, {
                "name": "Saint-Laurent",
                "lat": 45.51103299905212,
                "lng": -73.5648990000001
            }, {
                "name": "Place-des-Arts",
                "lat": 45.50821999905213,
                "lng": -73.56843300000008
            }, {
                "name": "McGill",
                "lat": 45.50406399905212,
                "lng": -73.5715860000001
            }, {
                "name": "Peel",
                "lat": 45.500878999052105,
                "lng": -73.57471500000008
            }, {
                "name": "Guy–Concordia",
                "lat": 45.495569999052115,
                "lng": -73.57931000000009
            }, {
                "name": "Atwater",
                "lat": 45.49006799905212,
                "lng": -73.58581200000009
            }, {
                "name": "Lionel-Groulx",
                "lat": 45.482508999052094,
                "lng": -73.58018000000008
            }, {
                "name": "Charlevoix",
                "lat": 45.47846499905209,
                "lng": -73.56933600000009
            }, {
                "name": "LaSalle",
                "lat": 45.4710629990521,
                "lng": -73.56626700000008
            }, {
                "name": "De L'Église",
                "lat": 45.4618939990521,
                "lng": -73.5670740000001
            }, {
                "name": "Verdun",
                "lat": 45.45944099905209,
                "lng": -73.57202100000009
            }, {
                "name": "Jolicoeur",
                "lat": 45.45700999905209,
                "lng": -73.58169100000009
            }, {
                "name": "Monk",
                "lat": 45.45115799905209,
                "lng": -73.5932420000001
            }, {
                "name": "Angrignon",
                "lat": 45.446465999052094,
                "lng": -73.60311800000008
            }]
        },
        {
            name: "orange",
            stations:
                [{
                    "name": "Montmorency",
                    "lat": 45.558435999052165,
                    "lng": -73.72245900000007
                }, {
                    "name": "De La Concorde",
                    "lat": 45.560697999052145,
                    "lng": -73.70938900000009
                }, {
                    "name": "Cartier",
                    "lat": 45.55991799905214,
                    "lng": -73.68222900000009
                }, {
                    "name": "Henri-Bourassa",
                    "lat": 45.555276999052154,
                    "lng": -73.66817200000008
                }, {
                    "name": "Sauvé",
                    "lat": 45.55075699905215,
                    "lng": -73.6560170000001
                }, {
                    "name": "Crémazie",
                    "lat": 45.54608199905215,
                    "lng": -73.63905200000009
                }, {
                    "name": "Jarry",
                    "lat": 45.54319099905216,
                    "lng": -73.62876500000009
                }, {
                    "name": "Jean-Talon",
                    "lat": 45.53905599905215,
                    "lng": -73.61390200000008
                }, {
                    "name": "Beaubien",
                    "lat": 45.535353999052134,
                    "lng": -73.6046880000001
                }, {
                    "name": "Rosemont",
                    "lat": 45.53173299905215,
                    "lng": -73.59778000000009
                }, {
                    "name": "Laurier",
                    "lat": 45.52739899905213,
                    "lng": -73.58690700000008
                }, {
                    "name": "Mont-Royal",
                    "lat": 45.52493099905214,
                    "lng": -73.58195900000008
                }, {
                    "name": "Sherbrooke",
                    "lat": 45.51905999905213,
                    "lng": -73.56921700000008
                }, {
                    "name": berriUqamName,
                    "lat": 45.515211999052134,
                    "lng": -73.5610510000001
                }, {
                    "name": "Champ-de-Mars",
                    "lat": 45.51004699905212,
                    "lng": -73.5565960000001
                }, {
                    "name": "Place-d'Armes",
                    "lat": 45.506347999052124,
                    "lng": -73.5595480000001
                }, {
                    "name": "Square-Victoria–OACI",
                    "lat": 45.50193699905212,
                    "lng": -73.5631180000001
                }, {
                    "name": "Bonaventure",
                    "lat": 45.498085999052094,
                    "lng": -73.5672350000001
                }, {
                    "name": "Lucien-L'Allier",
                    "lat": 45.49474499905209,
                    "lng": -73.5710740000001
                }, {
                    "name": "Georges-Vanier",
                    "lat": 45.488896999052116,
                    "lng": -73.57685200000009
                }, {
                    "name": "Lionel-Groulx",
                    "lat": 45.482508999052094,
                    "lng": -73.58018000000008
                }, {
                    "name": "Place-Saint-Henri",
                    "lat": 45.4773199990521,
                    "lng": -73.58662900000009
                }, {
                    "name": "Vendôme",
                    "lat": 45.474100999052105,
                    "lng": -73.60370600000009
                }, {
                    "name": "Villa-Maria",
                    "lat": 45.479708999052114,
                    "lng": -73.61982100000009
                }, {
                    "name": "Snowdon",
                    "lat": 45.48543299905211,
                    "lng": -73.6277300000001
                }, {
                    "name": "Côte-Sainte-Catherine",
                    "lat": 45.4923559990521,
                    "lng": -73.6331000000001
                }, {
                    "name": "Plamondon",
                    "lat": 45.494643999052116,
                    "lng": -73.63826000000009
                }, {
                    "name": "Namur",
                    "lat": 45.49464299905212,
                    "lng": -73.65282800000008
                }, {
                    "name": "De La Savane",
                    "lat": 45.50005099905209,
                    "lng": -73.66153800000008
                }, {
                    "name": "Du Collège",
                    "lat": 45.50925799905213,
                    "lng": -73.67479600000009
                }, {
                    "name": "Côte-Vertu",
                    "lat": 45.514236999052144,
                    "lng": -73.68275700000008
                }]
        },
        {
            name: "jaune",
            stations: [{
                "name": "Longueuil–Université-de-Sherbrooke",
                "lat": 45.52488999905213,
                "lng": -73.5220980000001
            }, {
                "name": "Jean-Drapeau",
                "lat": 45.51242899905212,
                "lng": -73.53312700000009
            }, {
                "name": berriUqamName,
                "lat": 45.51519099905214,
                "lng": -73.5610130000001
            }]
        }
        // ,    {"name": "Ligne 5 - Bleue 0", "lat": 45.48540299905209, "lng": -73.62775700000009}, {
        //     "name": "Ligne 5 - Bleue 1",
        //     "lat": 45.49684599905211,
        //     "lng": -73.62338600000008
        // }
        // , {"name": "Ligne 5 - Bleue 2", "lat": 45.50318799905213, "lng": -73.61769900000009}, {
        //     "name": "Ligne 5 - Bleue 3",
        //     "lat": 45.50991999905213,
        //     "lng": -73.61285800000009
        // }, {"name": "Ligne 5 - Bleue 4", "lat": 45.52036999905214, "lng": -73.61497600000008}, {
        //     "name": "Ligne 5 - Bleue 5",
        //     "lat": 45.52345799905212,
        //     "lng": -73.62325700000008
        // }, {"name": "Ligne 5 - Bleue 6", "lat": 45.53017699905214, "lng": -73.6245590000001}, {
        //     "name": "Ligne 5 - Bleue 7",
        //     "lat": 45.535436999052145,
        //     "lng": -73.61987300000008
        // }, {
        //     "name": "Ligne 5 - Bleue 8",
        //     "lat": 45.539151999052145,
        //     "lng": -73.61385600000008
        // }, {
        //     "name": "Ligne 5 - Bleue 9",
        //     "lat": 45.546752999052124,
        //     "lng": -73.60810600000009
        // }, {
        //     "name": "Ligne 5 - Bleue 10",
        //     "lat": 45.55361799905216,
        //     "lng": -73.6019880000001
        // }, {"name": "Ligne 5 - Bleue 11", "lat": 45.55955999905216, "lng": -73.6000020000001}
    ];

    for (const metroLine of metroLines) {
        const berriUqamIndex = metroLine.stations.findIndex(x => x.name === berriUqamName);
        metroLine.stations.forEach((item, index) => {
            item.stationDistance = Math.abs(index - berriUqamIndex);
            item.link = "https://google.com/maps?" + new URLSearchParams({q: `${item.lat}, ${item.lng}`})
        });
    }
}
