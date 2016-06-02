'use strict';

const request = require('request-promise');
const GoogleMapsAPI = require('googlemaps');

const googleMapsAPI = new GoogleMapsAPI({
	key: Homey.env.GOOGLE_API_KEY,
	stagger_time: 1000,
	encode_polylines: false,
	secure: true
});

class YahooWeather {

	constructor(options) {

		// Set defaults
		this.temp_metric = options.temp_metric;
		this.latitude = options.latitude;
		this.longitude = options.longitude;

		// These will be retrieved
		this.woeid = undefined;
		this.city = undefined;

		// Retrieve city name and woeid
		this._getWoeid();

		// Expose yahoo weather queries
		this.queries = function createQueries() {
			return {
				forecast: `select * from weather.forecast where woeid=${this.woeid} and u="${this.temp_metric}"`,
				current: `select item.condition from weather.forecast where woeid=${this.woeid}`,
			};
		};
	}

	_reverseGeoLocation(lat, lon) {
		return new Promise(function (resolve, reject) {
			googleMapsAPI.reverseGeocode({
				"latlng": `${lat},${lon}`,
				"result_type": "locality",
				"language": "en",
				"location_type": "APPROXIMATE"
			}, function (err, data) {
				if (!err && data && data.results.length > 0) {
					resolve(data.results[0].address_components[0].long_name)
				}
				else {
					reject()
				}
			});
		});
	}

	_convertCityToWoeid(city) {

		// Make request to retrieve woeid of location
		return request(`http://where.yahooapis.com/v1/places.q('${city}')?format=json&appid=${Homey.env.YAHOO_CLIENT_ID}`);
	}

	_getWoeid() {

		// Do not re-fetch value if present
		if (this.woeid) return Promise.resolve(this.woeid);

		// Fetch woeid and return promise
		return new Promise((resolve, reject) => {

			// First reverse lat long to a city name
			this._reverseGeoLocation(this.latitude, this.longitude)
				.then((res) => {

					// Store city name
					this.city = res;

					// Covert city name to woeid
					this._convertCityToWoeid(this.city)
						.then((res) => {

							// Store woeid
							this.woeid = JSON.parse(res).places.place[0].woeid;

							// Resolve promise
							resolve(this.woeid);
						})
						.catch((err) => {
							console.error(`Error converting city to woeid: ${err}`);

							// Failed
							reject(err);
						});
				})
				.catch((err) => {
					console.error(`Error reversing geo location: ${err}`);

					// Failed
					reject(err);
				});
		});
	}

	_queryYahooAPI(weatherYQL) {

		// Make request to fetch weather information from yahoo
		return request(weatherYQL);
	}

	getConditionMetadata(code) {
		console.log(code);
		// Get metadata belonging to weather code
		return yahooConditions[(code === '3200') ? 48 : code]
	}

	fetchData() {

		// Return promise
		return new Promise((resolve, reject) => {

			// Make sure woeid is set
			this._getWoeid().then(() => {

				// Make the weather api request
				this._queryYahooAPI('https://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(this.queries().forecast) + '&format=json')
					.then((data) => {
						let jsonData = JSON.parse(data);

						// If no data provided, try again
						if (!jsonData.query.results) {

							// Make the weather api request
							this._queryYahooAPI('https://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(this.queries().forecast) + '&format=json')
								.then((data) => {

									// Resolve with data
									resolve(JSON.parse(data).query.results);
								})
								.catch((err) => {

									// Reject
									reject(err);
								});
						}
						else {

							// Resolve with data
							resolve(JSON.parse(data).query.results);
						}
					})
					.catch((err) => {

						// Reject
						reject(err);
					});
			})
				.catch((err) => {

					// Reject
					reject(err);
				});
		});
	}
}

const yahooConditions = [
	{
		'index': 0,
		'type': 'tornado',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': "tornado's",
				'en': 'tornados',
				'plural': true
			}
		},
	},
	{
		'index': 1,
		'type': 'tropical storm',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'een tropische storm',
				'en': 'a tropical storm',
				'plural': false
			}
		},
	},
	{
		'index': 2,
		'type': 'huricane',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'een orkaan',
				'en': 'a huricane',
				'plural': false
			}
		},
	},
	{
		'index': 3,
		'type': 'severe thunderstorms',
		'quantity': 'severe',
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'zware onweersbuien',
				'en': 'severe thunderstorms',
				'plural': true
			}
		},
	},
	{
		'index': 4,
		'type': 'thunderstorm',
		'quantity': 'severe',
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'onweer',
				'en': 'a thunderstorm',
				'plural': false
			}
		},
	},
	{
		'index': 5,
		'type': 'rain and snow',
		'quantity': 'mixed',
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'regen en sneeuw',
				'en': 'rain and snow',
				'plural': false
			}
		},
	},
	{
		'index': 6,
		'type': 'rain and sleet',
		'quantity': 'mixed',
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'regen en ijzel',
				'en': 'rain and sleet',
				'plural': false
			}
		},
	},
	{
		'index': 7,
		'type': 'snow and sleet',
		'quantity': 'mixed',
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'sneeuw en ijzel',
				'en': 'snow and sleet',
				'plural': false
			}
		},
	},
	{
		'index': 8,
		'type': 'freezing drizzle',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'lichte ijzel',
				'en': 'freezing drizzle',
				'plural': false
			}
		},
	},
	{
		'index': 9,
		'type': 'drizzle',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'licht regenachtige',
				'en': 'drizzly'
			},
			'noun': {
				'nl': 'motregen',
				'en': 'drizzle',
				'plural': false
			}
		},
	},
	{
		'index': 10,
		'type': 'freezing rain',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'ijzel',
				'en': 'freezing rain',
				'plural': false
			}
		},
	},
	{
		'index': 11,
		'type': 'shower',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'regenachtige',
				'en': 'rainy'
			},
			'noun': {
				'nl': 'regenbuien',
				'en': 'showers',
				'plural': true
			}
		},
	},
	{
		'index': 12,
		'type': 'shower',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'regenachtige',
				'en': 'rainy'
			},
			'noun': {
				'nl': 'regenbuien',
				'en': 'showers',
				'plural': true
			}
		},
	},
	{
		'index': 13,
		'type': 'snow flurry',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'sneeuw vlagen',
				'en': 'snow flurry',
				'plural': false
			}
		},
	},
	{
		'index': 14,
		'type': 'snow shower',
		'quantity': 'light',
		'text': {
			'adjective': {
				'nl': 'sneeuwachtige',
				'en': 'snowy'
			},
			'noun': {
				'nl': 'sneeuw',
				'en': 'snow showers',
				'plural': true
			}
		},
	},
	{
		'index': 15,
		'type': 'blowing snow',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'sneeuwbuien',
				'en': 'blowing snow',
				'plural': false
			}
		},
	},
	{
		'index': 16,
		'type': 'snow',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'sneeuwachtige',
				'en': 'snowy'
			},
			'noun': {
				'nl': 'snow',
				'en': 'snow',
				'plural': false
			}
		},
	},
	{
		'index': 17,
		'type': 'hail',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'hagel',
				'en': 'hail',
				'plural': false
			}
		},
	},
	{
		'index': 18,
		'type': 'sleet',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'ijzelige',
				'en': 'sleety'
			},
			'noun': {
				'nl': 'ijzel',
				'en': 'sleet',
				'plural': false
			}
		},
	},
	{
		'index': 19,
		'type': 'dust',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'stoffige',
				'en': 'dusty'
			},
			'noun': {
				'nl': 'stof',
				'en': 'dust',
				'plural': false
			}
		},
	},
	{
		'index': 20,
		'type': 'fog',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'mistige',
				'en': 'foggy'
			},
			'noun': {
				'nl': 'mist',
				'en': 'fog',
				'plural': false
			}
		},
	},
	{
		'index': 21,
		'type': 'haze',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'mistige',
				'en': 'hazy'
			},
			'noun': {
				'nl': 'mist',
				'en': 'haze',
				'plural': false
			}
		},
	},
	{
		'index': 22,
		'type': 'smoke',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'rookwolken',
				'en': 'smoke clouds',
				'plural': true
			}
		},
	},
	{
		'index': 23,
		'type': 'wind',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'winderige',
				'en': 'windy'
			},
			'noun': {
				'nl': 'wind',
				'en': 'wind',
				'plural': false
			}
		},
	},
	{
		'index': 24,
		'type': 'wind',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'winderige',
				'en': 'windy'
			},
			'noun': {
				'nl': 'wind',
				'en': 'wind',
				'plural': false
			}
		},
	},
	{
		'index': 25,
		'type': 'cold',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'koude',
				'en': 'cold'
			},
			'noun': {
				'nl': 'kou',
				'en': 'cold',
				'plural': false
			}
		},
	},
	{
		'index': 26,
		'type': 'clouds',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'bewolkte',
				'en': 'cloudy'
			},
			'noun': {
				'nl': 'bewolking',
				'en': 'clouds',
				'plural': true
			}
		},
	},
	{
		'index': 27,
		'type': 'clouds',
		'quantity': 'mostly',
		'text': {
			'adjective': {
				'nl': 'erg bewolkte',
				'en': 'mostly cloudy'
			},
			'noun': {
				'nl': 'veel bewolking',
				'en': 'quite some clouds',
				'plural': true
			}
		},
	},
	{
		'index': 28,
		'type': 'clouds',
		'quantity': 'mostly',
		'text': {
			'adjective': {
				'nl': 'erg bewolkte',
				'en': 'mostly cloudy'
			},
			'noun': {
				'nl': 'veel bewolking',
				'en': 'quite some clouds',
				'plural': true
			}
		},
	},
	{
		'index': 29,
		'type': 'clouds',
		'quantity': 'partly',
		'text': {
			'adjective': {
				'nl': 'licht bewolkte',
				'en': 'partly cloudy'
			},
			'noun': {
				'nl': 'lichte bewolking',
				'en': 'some clouds',
				'plural': true
			}
		},
	},
	{
		'index': 30,
		'type': 'clouds',
		'quantity': 'partly',
		'text': {
			'adjective': {
				'nl': 'licht bewolkte',
				'en': 'partially cloudy'
			},
			'noun': {
				'nl': 'lichte bewolking',
				'en': 'some clouds',
				'plural': true
			}
		},
	},
	{
		'index': 31,
		'type': 'clear',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'heldere',
				'en': 'clear'
			},
			'noun': {
				'nl': 'helder',
				'en': 'clear',
				'plural': false
			}
		},
	},
	{
		'index': 32,
		'type': 'sun',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'zonnige',
				'en': 'sunny'
			},
			'noun': {
				'nl': 'zon',
				'en': 'sun',
				'plural': false
			}
		},
	},
	{
		'index': 33,
		'type': 'fair',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'mooie',
				'en': 'fair'
			},
			'noun': {
				'nl': 'mooi',
				'en': 'fair',
				'plural': false
			}
		},
	},
	{
		'index': 34,
		'type': 'fair',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'mooie',
				'en': 'fair'
			},
			'noun': {
				'nl': 'mooi',
				'en': 'fair',
				'plural': false
			}
		},
	},
	{
		'index': 35,
		'type': 'rain and hail',
		'quantity': 'mixed',
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'regen en hagel',
				'en': 'rain and hail',
				'plural': false
			}
		},
	},
	{
		'index': 36,
		'type': 'hot',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'warme',
				'en': 'hot'
			},
			'noun': {
				'nl': 'warm',
				'en': 'hot',
				'plural': false
			}
		},
	},
	{
		'index': 37,
		'type': 'thunderstorm',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'zwaar onweer',
				'en': 'thunderstorms',
				'plural': true
			}
		},
	},
	{
		'index': 38,
		'type': 'thunderstorm',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'zwaar onweer',
				'en': 'thunderstorms',
				'plural': true
			}
		},
	},
	{
		'index': 39,
		'type': 'thunderstorm',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'zwaar onweer',
				'en': 'thunderstorms',
				'plural': true
			}
		},
	},
	{
		'index': 40,
		'type': 'shower',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'regenachtige',
				'en': 'rainy'
			},
			'noun': {
				'nl': 'regenbuien',
				'en': 'showers',
				'plural': true
			}
		},
	},
	{
		'index': 41,
		'type': 'snow',
		'quantity': 'heavy',
		'text': {
			'adjective': {
				'nl': 'sneeuwachtige',
				'en': 'snowy'
			},
			'noun': {
				'nl': 'zware sneeuwbuien',
				'en': 'heavy snow',
				'plural': false
			}
		},
	},
	{
		'index': 42,
		'type': 'snow',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'sneeuwachtige',
				'en': 'snowy'
			},
			'noun': {
				'nl': 'sneeuwbuien',
				'en': 'snow',
				'plural': false
			}
		},
	},
	{
		'index': 43,
		'type': 'snow',
		'quantity': 'heavy',
		'text': {
			'adjective': {
				'nl': 'sneeuwachtige',
				'en': 'snowy'
			},
			'noun': {
				'nl': 'zware sneeuwbuien',
				'en': 'heavy snow',
				'plural': false
			}
		},
	},
	{
		'index': 44,
		'type': 'clouds',
		'quantity': 'partly',
		'text': {
			'adjective': {
				'nl': 'matig bewolkte',
				'en': 'partially cloudy'
			},
			'noun': {
				'nl': 'matige bewolking',
				'en': 'some clouds',
				'plural': true
			}
		},
	},
	{
		'index': 45,
		'type': 'thundershowers',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'onweer en zware regenbuien',
				'en': 'thunderstorms',
				'plural': true
			}
		},
	},
	{
		'index': 46,
		'type': 'snow',
		'quantity': undefined,
		'text': {
			'adjective': {
				'nl': 'sneeuwachtige',
				'en': 'snowy'
			},
			'noun': {
				'nl': 'sneeuwbuien',
				'en': 'snow',
				'plural': false
			}
		},
	},
	{
		'index': 47,
		'type': 'thundershowers',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'onweer en zware regenbuien',
				'en': 'thunderstorms',
				'plural': true
			}
		},
	},
	{
		'index': 3200,
		'type': 'unavailable',
		'quantity': undefined,
		'text': {
			'adjective': undefined,
			'noun': {
				'nl': 'niet beschikbaar',
				'en': 'unavailable',
				'plural': false
			}
		},
	},
];

module.exports = YahooWeather;
