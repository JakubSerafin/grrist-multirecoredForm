# Grist – Widget odczytu liczników

Niestandardowy widget Grist do jednoczesnego wprowadzania odczytów **Gazu**, **Wody** i **Prądu**.

## Wymagana struktura tabel w Grist

### Tabela główna (np. `Liczniki` lub dowolna inna)

| Kolumna | Typ Grist | Opis |
|---|---|---|
| `Data` | Date | Data odczytu |
| `Stan_licznika` | Numeric | Aktualny stan licznika |
| `Typ_licznika` | Reference → `Typ_licznika` | Odniesienie do tabeli typów |
| `Przyrost_od_ostatniego_zczytania` | Numeric | Obliczany automatycznie przez widget |
| `Nazwa` | Text | Automatyczna etykieta (np. „2024-03-01 Gaz") |

### Tabela pomocnicza `Typ_licznika`

| Kolumna | Typ Grist | Wartości |
|---|---|---|
| `Typ` | Text | `Gaz`, `Prąd`, `Woda` |

> Widget automatycznie wyszuka IDs typów z tej tabeli. Jeśli tabela nie istnieje, widget spróbuje ją utworzyć.

## Hosting widgetu

Widget to pojedynczy plik HTML – `widget.html`. Możesz go udostępnić na kilka sposobów:

### Opcja A – GitHub Pages (zalecane)
1. Utwórz repozytorium na GitHub i wgraj `widget.html`.
2. Włącz GitHub Pages (Settings → Pages → Source: `main`, folder `/`).
3. Widget będzie dostępny pod adresem: `https://<user>.github.io/<repo>/widget.html`

### Opcja B – Lokalny serwer (do testów)
```bash
# Python 3
python -m http.server 8080
# Widget dostępny na: http://localhost:8080/widget.html
```

## Konfiguracja w Grist

1. Otwórz dokument Grist.
2. Kliknij **Add New → Add Widget to Page**.
3. W polu **Select Widget** wybierz **Custom**.
4. W polu **Select Data** wybierz tabelę z odczytami (np. `Liczniki`).
5. Kliknij ⋮ na widgecie → **Widget options**.
6. W polu **Enter Custom URL** wklej URL do `widget.html`.
7. Zaakceptuj uprawnienia **Full document access** (wymagane do zapisu).

## Działanie widgetu

- **Data** – domyślnie ustawiona na dzisiejszą datę (edytowalna).
- **Gaz / Woda / Prąd** – pola na stan licznika; pozostaw puste, jeśli nie ma odczytu.
- Pole `Przyrost_od_ostatniego_zczytania` jest obliczane jako różnica między nowym stanem a ostatnim zapisanym odczytem danego typu.
- Po kliknięciu **Zapisz odczyty** tworzone są rekordy tylko dla uzupełnionych pól.
- Podpowiedzi pod polami pokazują ostatni zapisany odczyt danego licznika.
