// API endpoint - works for both local and production proxy
        const API_BASE = window.location.pathname.startsWith('/watchtower') ? '/watchtower' : '';
        const API_BASE_URL = window.location.origin + API_BASE;

        // Load current settings on page load
        window.addEventListener('DOMContentLoaded', async () => {
            await loadCurrentSettings();

            // Sync IC year with OC year input
            document.getElementById('ocYear').addEventListener('input', (e) => {
                document.getElementById('icYear').value = e.target.value;
                updateDayOfWeekPreview();
            });

            document.getElementById('ocDay').addEventListener('input', updateDayOfWeekPreview);
            document.getElementById('ocMonth').addEventListener('change', updateDayOfWeekPreview);
            document.getElementById('icStartDayOfWeek').addEventListener('change', updateDayOfWeekPreview);
        });

        async function loadCurrentSettings() {
            const loadingStatus = document.getElementById('loadingStatus');
            loadingStatus.textContent = 'Loading current settings...';

            try {
                const response = await fetch(`${API_BASE_URL}/api/time/settings`);
                if (response.ok) {
                    const data = await response.json();
                    const ocDate = formatDateForInput(data.ocEventStartDate);
                    const icDate = formatDateForInput(data.icEventStartDate);
                    const offset = data.icDayOfWeekOffset ?? 0;
                    const ocStartDayNum = getLocalizedDayNumber(new Date(data.ocEventStartDate).getUTCDay());
                    const icStartDayNum = data.icStartDayOfWeek ?? ((((ocStartDayNum - 1 + offset) % 7) + 7) % 7) + 1;

                    document.getElementById('ocDay').value = ocDate.day;
                    document.getElementById('ocMonth').value = numberToMonthName(ocDate.month);
                    document.getElementById('ocYear').value = ocDate.year;

                    document.getElementById('icDay').value = icDate.day;
                    document.getElementById('icMonth').value = numberToMonthName(icDate.month);
                    // The IC year should always match the OC year
                    document.getElementById('icYear').value = ocDate.year;
                    document.getElementById('icStartYear').value = data.icStartYear;
                    document.getElementById('icStartDayOfWeek').value = String(icStartDayNum);

                    // Display current dates in DD/MMM/YYYY format
                    document.getElementById('ocCurrentDisplay').textContent = `Current: ${ocDate.day}/${numberToMonthName(ocDate.month)}/${ocDate.year}`;
                    // The IC year display should also match the OC year
                    document.getElementById('icCurrentDisplay').textContent = `Current: ${icDate.day}/${numberToMonthName(icDate.month)}`;
                    document.getElementById('icStartYearDisplay').textContent = `Current: ${data.icStartYear}`;

                    const dayUnit = Math.abs(offset) === 1 ? 'day' : 'days';
                    document.getElementById('icStartDayOfWeekDisplay').textContent = `Current: ${dayNames[icStartDayNum - 1]} (calculated offset: ${formatOffset(offset)} ${dayUnit})`;
                    updateDayOfWeekPreview();

                    loadingStatus.textContent = 'Current settings loaded successfully.';
                    loadingStatus.style.color = '#28a745';
                } else {
                    const error = await response.json();
                    loadingStatus.textContent = `Failed to load settings: ${error.error || 'Unknown error'}`;
                    loadingStatus.style.color = '#dc3545';
                }
            } catch (error) {
                console.error('Error loading settings:', error);
                loadingStatus.textContent = `Error loading settings: ${error.message}. Make sure the API server is running.`;
                loadingStatus.style.color = '#dc3545';
            }
        }

        function formatDateForInput(dateString) {
            const date = new Date(dateString);
            return {
                day: date.getUTCDate(),
                month: date.getUTCMonth() + 1, // getUTCMonth() returns 0-11, we want 1-12
                year: date.getUTCFullYear()
            };
        }

        function formatDateForDisplay(dateString) {
            const date = new Date(dateString);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthMap = {
            'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
            'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
        };

        function numberToMonthName(monthNum) {
            return monthNames[monthNum - 1];
        }

        function monthNameToNumber(monthName) {
            return monthMap[monthName] || null;
        }

        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        function getLocalizedDayNumber(utcDay) {
            return utcDay === 0 ? 7 : utcDay;
        }

        function calculateDayOfWeekOffset(ocDayNumber, icDayNumber) {
            return (((icDayNumber - ocDayNumber) % 7) + 7) % 7;
        }

        function formatOffset(offset) {
            return offset > 0 ? `+${offset}` : `${offset}`;
        }

        function getSelectedOcStartDayNumber() {
            const day = Number(document.getElementById('ocDay').value);
            const month = monthNameToNumber(document.getElementById('ocMonth').value);
            const year = Number(document.getElementById('ocYear').value);
            if (!Number.isInteger(day) || !month || !Number.isInteger(year) || day < 1 || day > 31) {
                return null;
            }
            const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
            if (
                date.getUTCFullYear() !== year ||
                date.getUTCMonth() !== month - 1 ||
                date.getUTCDate() !== day
            ) {
                return null;
            }
            return getLocalizedDayNumber(date.getUTCDay());
        }

        function updateDayOfWeekPreview() {
            const previewEl = document.getElementById('icDayOfWeekPreview');
            const ocDayNum = getSelectedOcStartDayNumber();
            const icDayNum = Number(document.getElementById('icStartDayOfWeek').value);

            if (!ocDayNum || !Number.isInteger(icDayNum) || icDayNum < 1 || icDayNum > 7) {
                previewEl.textContent = '';
                return;
            }

            const offset = calculateDayOfWeekOffset(ocDayNum, icDayNum);
            const dayUnit = offset === 1 ? 'day' : 'days';
            previewEl.textContent = `OC starts ${dayNames[ocDayNum - 1]} -> calculated offset: ${formatOffset(offset)} ${dayUnit}`;
        }

        document.getElementById('refreshBtn').addEventListener('click', async () => {
            await loadCurrentSettings();
        });

        document.getElementById('dateForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const ocDay = document.getElementById('ocDay').value;
            const ocMonthName = document.getElementById('ocMonth').value;
            const ocMonth = monthNameToNumber(ocMonthName);
            const ocYear = document.getElementById('ocYear').value;

            const icDay = document.getElementById('icDay').value;
            const icMonthName = document.getElementById('icMonth').value;
            const icMonth = monthNameToNumber(icMonthName);
            const icYear = document.getElementById('icYear').value;
            const icStartYear = document.getElementById('icStartYear').value;
            const icStartDayOfWeek = Number(document.getElementById('icStartDayOfWeek').value);

            // Validate month names
            if (!ocMonth || !icMonth) {
                const messageDiv = document.getElementById('message');
                messageDiv.textContent = 'Error: Invalid month name. Please use: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, or Dec';
                messageDiv.className = 'message error';
                messageDiv.style.display = 'block';
                return;
            }

            if (!Number.isInteger(icStartDayOfWeek) || icStartDayOfWeek < 1 || icStartDayOfWeek > 7) {
                const messageDiv = document.getElementById('message');
                messageDiv.textContent = 'Error: Please select a valid IC start day of week.';
                messageDiv.className = 'message error';
                messageDiv.style.display = 'block';
                return;
            }

            // Construct date strings in YYYY-MM-DD format for API
            const ocDateString = `${ocYear}-${ocMonth.toString().padStart(2, '0')}-${ocDay.padStart(2, '0')}`;
            const icDateString = `${icYear}-${icMonth.toString().padStart(2, '0')}-${icDay.padStart(2, '0')}`;

            // Clear any previous messages
            document.getElementById('loadingStatus').textContent = 'Updating settings...';
            document.getElementById('loadingStatus').style.color = '#666';

            try {
                const response = await fetch(`${API_BASE_URL}/api/time/settings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ocEventStartDate: new Date(ocDateString + 'T12:00:00Z').toISOString(),
                        icEventStartDate: new Date(icDateString + 'T12:00:00Z').toISOString(),
                        icStartYear: Number(icStartYear),
                        icStartDayOfWeek: icStartDayOfWeek,
                    })
                });

                const messageDiv = document.getElementById('message');
                const loadingStatus = document.getElementById('loadingStatus');

                if (response.ok) {
                    const data = await response.json();
                    const savedOffset = data.data && data.data.icDayOfWeekOffset !== undefined
                        ? data.data.icDayOfWeekOffset
                        : 0;
                    messageDiv.textContent = data.message;
                    messageDiv.className = 'message success';
                    messageDiv.style.display = 'block';
                    loadingStatus.textContent = `Settings updated. OC: ${ocDay}/${ocMonthName}/${ocYear}, IC: ${dayNames[icStartDayOfWeek - 1]} ${icDay}/${icMonthName}/${icYear}, IC Start Year: ${icStartYear}, Calculated Offset: ${formatOffset(savedOffset)}`;
                    loadingStatus.style.color = '#28a745';
                } else {
                    const error = await response.json();
                    messageDiv.textContent = error.error || 'Failed to update settings';
                    messageDiv.className = 'message error';
                    messageDiv.style.display = 'block';
                    loadingStatus.textContent = 'Update failed.';
                    loadingStatus.style.color = '#dc3545';
                }
            } catch (error) {
                const messageDiv = document.getElementById('message');
                messageDiv.textContent = 'Error: ' + error.message;
                messageDiv.className = 'message error';
                messageDiv.style.display = 'block';
                document.getElementById('loadingStatus').textContent = 'Update failed due to error.';
                document.getElementById('loadingStatus').style.color = '#dc3545';
            }
        });