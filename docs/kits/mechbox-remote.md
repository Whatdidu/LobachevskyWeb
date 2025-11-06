---
id: mechbox-remote
title: Пульт управления МехБокс
sidebar_label: Пульт МехБокс
---

# Пульт управления МехБокс

## 1. О пульте
Данная инструкция позволяет самостоятельно собрать пульт для управления контроллером MBX-A1.

- Управление газом осуществляется при помощи аналогового джойстика KY-023.
- Управление рулём реализовано при помощи магнитного энкодера AS5600.
- Контроллер ESP32 C3 mini отвечает за управление.

Все компоненты для сборки пульта можно приобрести в магазине Ozon, а их общая стоимость обычно не превышает 1000 рублей.

## 2. Функции
- Считывание угла поворота с энкодера AS5600 по I2C
- Считывание положения джойстика (2 оси, ADC)
- Формирование и отправка BLE-команды с параметрами (угол, моторы)
- Индикация состояния соединения встроенным LED
- Автоматический поиск и подключение к BLE-серверу
- Отладочный вывод в Serial

## 3. Пиновая карта
| Назначение         | Пин ESP32 | Описание                      |
|--------------------|-----------|-------------------------------|
| AS5600 SDA         | GPIO4     | I2C SDA                       |
| AS5600 SCL         | GPIO5     | I2C SCL                       |
| Джойстик VRx (X)   | GPIO20    | ADC1, ось X — мотор 1         |
| Джойстик VRy (Y)   | GPIO21    | ADC1, ось Y — мотор 2/серво   |

## 4. Прошивка контроллера

**Версия прошивки: 1.04** — инверсия направления рулевого управления через энкодер AS5600, добавлена чувствительность руля (STEERING_SENSITIVITY)

```cpp
#include <Wire.h>
#include <ESP32Servo.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <AS5600.h>

// --- Пины ---
#define AS5600_SDA 4
#define AS5600_SCL 5
#define VRX_PIN 0  // X-ось джойстика (ADC1_CH0, GPIO0)
#define VRY_PIN 1  // Y-ось джойстика (ADC1_CH1, GPIO1)
#define LED_PIN 8  // Встроенный LED на ESP32-C3-DevKitM-1 (инвертированная логика)

// --- Настройки чувствительности руля ---
#define STEERING_SENSITIVITY 2.0f // 1.0 — стандартно, 0.5 — менее острый руль, 2.0 — более острый

// --- Режим отладки ---
#define DEBUG_MODE 1 // 1 — дебаг включён, 0 — выключен

// --- BLE UUID ---
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// --- Глобальные переменные ---
AS5600 as5600;
BLEClient*  pClient = nullptr;
BLERemoteCharacteristic* pRemoteCharacteristic = nullptr;
BLEAdvertisedDevice* myDevice = nullptr;
bool deviceConnected = false;

// --- Настройки джойстика ---
const int joyCenter = 2048; // для 12-бит ADC ESP32-C3
const int deadZone = 200;   // мёртвая зона ±200

// --- BLE scan callback ---
class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
      if (advertisedDevice.haveServiceUUID() && advertisedDevice.isAdvertisingService(BLEUUID(SERVICE_UUID))) {
        myDevice = new BLEAdvertisedDevice(advertisedDevice);
      }
    }
};

void connectToServer() {
  pClient = BLEDevice::createClient();
  pClient->connect(myDevice); // Connect to the server
  BLERemoteService* pRemoteService = pClient->getService(SERVICE_UUID);
  if (pRemoteService == nullptr) {
    Serial.println("Failed to find our service UUID");
    pClient->disconnect();
    return;
  }
  pRemoteCharacteristic = pRemoteService->getCharacteristic(CHARACTERISTIC_UUID);
  if (pRemoteCharacteristic == nullptr) {
    Serial.println("Failed to find our characteristic UUID");
    pClient->disconnect();
    return;
  }
  deviceConnected = true;
  Serial.println("Connected to BLE server!");
}

void setup() {
  Serial.begin(115200);
  Serial.println("MBX_transmitter v1.04");

  // --- I2C и AS5600 ---
  Wire.begin(AS5600_SDA, AS5600_SCL);
  as5600.begin();

  // --- LED ---
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // --- BLE ---
  BLEDevice::init(""); // BLE client mode
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true);
  Serial.println("Scanning for BLE server...");
  while (myDevice == nullptr) {
    pBLEScan->start(1, false);
    // LED мигает, если не найдено устройство
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    delay(500);
  }
  BLEDevice::getScan()->stop();
  connectToServer();
}

void loop() {
  static unsigned long lastBlink = 0;
  static bool ledState = false;

  if (!deviceConnected) {
    Serial.println("Not connected to BLE server. Trying to reconnect...");
    connectToServer();
    // LED мигает, если нет соединения
    unsigned long now = millis();
    if (now - lastBlink > 500) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState ? LOW : HIGH);
      lastBlink = now;
    }
    delay(1000);
    return;
  } else {
    // LED горит постоянно при соединении
    digitalWrite(LED_PIN, LOW);
  }

  // --- Считываем угол с AS5600 ---
  int rawAngle = as5600.readAngle();
  int a = map(rawAngle, 0, 4095, 0, 180); // 12 бит → 0-180
  // Инверсия направления рулевого управления
  a = 180 - a;
  // Применяем чувствительность относительно центра
  a = 90 + (a - 90) * STEERING_SENSITIVITY;
  // Ограничиваем диапазон
  if (a < 0) a = 0;
  if (a > 180) a = 180;

  // --- Считываем джойстик X (VRx) и Y (VRy) ---
  int joyX = analogRead(VRX_PIN);
  int joyY = analogRead(VRY_PIN);

  // --- Обработка X (мотор 1) ---
  int dX = 0;
  int cX = 0;
  if (joyX > joyCenter + deadZone) {
    cX = 1;
    dX = map(joyX, joyCenter + deadZone, 4095, 0, 255);
  } else if (joyX < joyCenter - deadZone) {
    cX = 0;
    dX = map(joyX, joyCenter - deadZone, 0, 0, 255);
  } else {
    dX = 0;
  }
  int motorA = (dX == 0) ? 0 : (cX == 1 ? dX : -dX);

  // --- Обработка Y (мотор 2) ---
  int dY = 0;
  int cY = 0;
  if (joyY > joyCenter + deadZone) {
    cY = 1;
    dY = map(joyY, joyCenter + deadZone, 4095, 0, 255);
  } else if (joyY < joyCenter - deadZone) {
    cY = 0;
    dY = map(joyY, joyCenter - deadZone, 0, 0, 255);
  } else {
    dY = 0;
  }
  int motorB = (dY == 0) ? 0 : (cY == 1 ? dY : -dY);

  // --- Формируем BLE команду ---
  // Формат: "a,0,motorA,motorB,0"
  char bleMsg[32];
  snprintf(bleMsg, sizeof(bleMsg), "%d,0,%d,%d,0", a, motorA, motorB);

  // --- Отправляем BLE write ---
  if (deviceConnected && pRemoteCharacteristic != nullptr) {
    pRemoteCharacteristic->writeValue((uint8_t*)bleMsg, strlen(bleMsg), false);
  }

 

  // --- Дебаг: вывод BLE-команды ---
  #if DEBUG_MODE
  Serial.print("BLE CMD: ");
  Serial.println(bleMsg);
  #endif

  delay(50); // 20 Гц
}
``` 