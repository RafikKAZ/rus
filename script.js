document.addEventListener("DOMContentLoaded", function () {
    let map, placemark;
    let cityCenters = {}; // Здесь храниться координаты после геокодирования

    ymaps.ready(initMap);

    function initMap() {
        const citySelect = document.getElementById("city");
        const defaultCity = citySelect.value;

        // Получаем список всех названий городов из <select>
        const citiesToLoad = Array.from(citySelect.options).map(opt => opt.value);

        // Функция геокодирования одного города
        function geocodeCity(cityName) {
            return ymaps.geocode(cityName).then(res => {
                const firstObject = res.geoObjects.get(0);
                if (firstObject) {
                    const coords = firstObject.geometry.getCoordinates();
                    cityCenters[cityName] = coords;
                } else {
                    console.warn(`Не найдены координаты для города "${cityName}"`);
                }
            });
        }

        // Геокодируем все города параллельно
        Promise.all(citiesToLoad.map(geocodeCity)).then(() => {
            const defaultCityCenter = cityCenters[defaultCity];
            if (!defaultCityCenter) {
                alert("Невозможно загрузить карту: не найдены координаты для выбранного города.");
                return;
            }

            // Создаём карту
            map = new ymaps.Map("map", {
                center: defaultCityCenter,
                zoom: 10,
                controls: []
            });

        // Добавляем нужные контролы
           map.controls.add('zoomControl');

            // SearchControl
            const searchControl = new ymaps.control.SearchControl({
                options: {
                    noPlacemark: true,
                    boundedBy: [
                        [defaultCityCenter[0] - 0.1, defaultCityCenter[1] - 0.1],
                        [defaultCityCenter[0] + 0.1, defaultCityCenter[1] + 0.1]
                    ],
                    placeholderContent: 'Поиск дома в выбранном городе'
                }
            });
            map.controls.add(searchControl);

            // === geolocationControl с обработкой locationchange ===
            const geolocationControl = new ymaps.control.GeolocationControl();
            map.controls.add(geolocationControl);

            geolocationControl.events.add('locationchange', function (e) {
                const position = e.get('position');
                if (position) {
                    const coords = position.geometry.getCoordinates();
                    map.setCenter(coords, 16);
                    setPlacemarkAndAddress(coords);
                }
            });

            // Клик по карте
            map.events.add("click", function (e) {
                const coords = e.get("coords");
                setPlacemarkAndAddress(coords);
            });

            // Поиск дома через SearchControl
            searchControl.events.add("resultselect", function (e) {
                const index = e.get("index");
                searchControl.getResult(index).then(function (res) {
                    const coords = res.geometry.getCoordinates();
                    map.setCenter(coords, 16);
                    setPlacemarkAndAddress(coords);
                });
            });

            // Смена города в выпадающем списке
            citySelect.addEventListener("change", function () {
                const selectedCity = this.value;
                const selectedCityCenter = cityCenters[selectedCity];
                if (selectedCityCenter) {
                    map.setCenter(selectedCityCenter, 10);
                    searchControl.options.set('boundedBy', [
                        [selectedCityCenter[0] - 0.1, selectedCityCenter[1] - 0.1],
                        [selectedCityCenter[0] + 0.1, selectedCityCenter[1] + 0.1]
                    ]);
                } else {
                    alert("Не найдены координаты для выбранного города.");
                }
            });

            // Кнопка "Мое местоположение"
            const geolocationButton = new ymaps.control.Button({
                data: {
                    content: "Мое местоположение",
                    title: "Определить текущее местоположение"
                },
                options: {
                    layout: 'default#buttonLayoutWithIcon',
                    iconStyle: {
                        imageHref: 'https://cdn-icons-png.flaticon.com/512/1163/1163661.png', 
                        imageSize: [24, 24],
                        imageOffset: [-12, -12]
                    }
                }
            });

            geolocationButton.events.add('click', function () {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        function (position) {
                            const userCoords = [position.coords.latitude, position.coords.longitude];
                            map.setCenter(userCoords, 16);
                            setPlacemarkAndAddress(userCoords);
                        },
                        function (error) {
                            console.warn("Геолокация недоступна:", error.message);
                            alert("Не удалось определить местоположение.");
                        }
                    );
                } else {
                    alert("Геолокация не поддерживается вашим браузером.");
                }
            });

            map.controls.add(geolocationButton);

            // Автоматическое определение местоположения на мобильных устройствах
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function (position) {
                        const userCoords = [position.coords.latitude, position.coords.longitude];
                        map.setCenter(userCoords, 16);
                        setPlacemarkAndAddress(userCoords);
                    },
                    function (error) {
                        console.warn("Геолокация недоступна:", error.message);
                    }
                );
            }
        });
    }

    function createPlacemark(coords) {
        return new ymaps.Placemark(coords, {}, {
            preset: "islands#blueDotIcon",
            draggable: false
        });
    }

    function setPlacemarkAndAddress(coords) {
        if (placemark) {
            placemark.geometry.setCoordinates(coords);
        } else {
            placemark = createPlacemark(coords);
            map.geoObjects.add(placemark);
        }
        getAddress(coords);
    }

    function getAddress(coords) {
        ymaps.geocode(coords).then(function (res) {
            const firstGeoObject = res.geoObjects.get(0);
            const address = firstGeoObject.getAddressLine();
            document.getElementById("address").value = address;
            document.getElementById("coordinates").value = coords.join(", ");
            const preview = document.getElementById("selected-address");
            if (preview) {
                preview.innerText = 'Выбранный адрес: ' + address;
            }

            const citySelect = document.getElementById("city");
            let detectedCity = firstGeoObject.getLocalities()[0] || firstGeoObject.getAdministrativeAreas()[0];
            if (detectedCity) {
                const detected = detectedCity.toLowerCase();
                let matched = false;
                for (let i = 0; i < citySelect.options.length; i++) {
                    const optionText = citySelect.options[i].text.toLowerCase();
                    if (optionText.includes(detected)) {
                        citySelect.selectedIndex = i;
                        matched = true;
                        break;
                    }
                }
                const detectedCityInput = document.getElementById("detected_city");
                if (detectedCityInput) {
                    detectedCityInput.value = detectedCity;
                }
                if (!matched) {
                    const customOption = new Option(detectedCity, detectedCity, true, true);
                    citySelect.add(customOption, 0);
                    citySelect.selectedIndex = 0;
                }
            }

            const confirmation = document.getElementById("confirmation");
            if (confirmation) {
                confirmation.classList.remove("hidden");
                setTimeout(() => confirmation.classList.add("hidden"), 800000);
            }
        });
    }

    // === Отправка формы ===
    document.getElementById("submissionForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        const address = document.getElementById("address").value.trim();
        const coordinates = document.getElementById("coordinates").value.trim();
        const submitBtn = document.querySelector("#submissionForm button[type='submit']");
        if (address === "" || coordinates === "") {
            alert("Пожалуйста, выберите адрес дома на карте или включите геолокацию.");
            return;
        }
        const formData = new FormData(event.target);
        if (submitBtn) submitBtn.disabled = true;
        try {
            const response = await fetch("https://script.google.com/macros/s/AKfycbyvGVEFMym5wPSWUHnfhl_KN_oDnhsgvmRGSohGK1CmUF8JeHkNl_Pd8HLuglQSlSpa/exec",  {
                method: "POST",
                body: formData,
            });
            if (response.ok) {
                alert("Спасибо за заявку! Мы рассмотрим её в ближайшие несколько рабочих дней.\n\nЕсли большинство жителей Вашего дома подадут заявки на подключение «Интернет Дома», мы сможем приоритизировать строительство сети по Вашему адресу.\nСпасибо за доверие!");
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = "Заявка отправлена";
                }
                resetForm(false);
                return;
            }
            alert("Ошибка при отправке. Пожалуйста, попробуйте ещё раз позже.");
            if (submitBtn) submitBtn.disabled = false;
        } catch (error) {
            console.error("Ошибка:", error);
            alert("Произошла ошибка при отправке данных.");
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    function resetForm(preserveDisable = true) {
        document.getElementById("submissionForm").reset();
        if (placemark) {
            map.geoObjects.remove(placemark);
            placemark = null;
        }
        const preview = document.getElementById("selected-address");
        if (preview) preview.innerText = 'Адрес не выбран';
        const confirmation = document.getElementById("confirmation");
        if (confirmation) confirmation.classList.add("hidden");
        if (!preserveDisable) {
            const submitBtn = document.querySelector("#submissionForm button[type='submit']");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "Отправить заявку";
            }
        }
    }

    // === Ограничения ввода ===
    document.getElementById("name").addEventListener("input", function () {
        this.value = this.value.replace(/[^А-Яа-яЁёӘәӨөҚқҢңҰұҮүҺһІі\s\-]/g, '');
    });
    document.getElementById("phone").addEventListener("input", function () {
        this.value = this.value.replace(/[^\d]/g, '');
    });
});
