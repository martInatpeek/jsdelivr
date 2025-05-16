export default async function run() {
    const extensionHandler = this.callPeekExtensionsAPI('invokeLookup', 'extensions/extension-handler');
    await extensionHandler.dynamicallyImportLocalWebComponents({
        type: 'web-component'
    });
    const shoppingCartService = this.callPeekExtensionsAPI('invokeLookup', 'shopping-cart');
    // Add this once globally (not inside the shadowRoot)
    const globalStyle = document.createElement('style');
    globalStyle.textContent = `
    .announcements-ext-scrollable-content {
      max-height: 150px;
      overflow-y: auto;
    }

    .announcements-ext-dot-separator {
      width: 6px;
      height: 6px;
      background: #2196f3;
      border-radius: 50%;
      margin: 1rem auto;
    }
  `;
    document.head.appendChild(globalStyle);
    // Cache for the last request parameters to avoid duplicate requests
    let lastRequestParams = null;
    // Store announcements data for reuse
    let cachedAnnouncementsByDate = {};
    // Helper function to get activity ID from program configuration
    const getActivityId = () => {
        // temporary return hardcoded activity id
        return '32594d8f-3f95-4607-8024-52e610a44b49';
        if (shoppingCartService.programConfigurationExt) {
            const programConfiguration = shoppingCartService.programConfigurationExt;
            if (programConfiguration.get('activity') && programConfiguration.get('activity.id')) {
                return programConfiguration.get('activity.id');
            }
            if (programConfiguration.get('isProductFeed') && programConfiguration.get('programConfigurationActivities')) {
                const activityIds = programConfiguration.get('programConfigurationActivities').map((programConf) => {
                    return programConf.get('activity.id');
                });
                if (activityIds && activityIds.length > 0) {
                    return activityIds[0];
                }
            }
        }
        // Default activity ID if none found
        return '32594d8f-3f95-4607-8024-52e610a44b49';
    };
    // Helper function to get browsing dates from purchase extension
    const getBrowsingDates = () => {
        let startDate = moment().format('YYYY-MM-DD');
        let endDate = moment().add(1, 'month').format('YYYY-MM-DD');
        if (shoppingCartService.purchaseExt) {
            if (shoppingCartService.purchaseExt.get('browsingStartDate')) {
                startDate = shoppingCartService.purchaseExt.get('browsingStartDate');
            }
            if (shoppingCartService.purchaseExt.get('browsingEndDate')) {
                endDate = shoppingCartService.purchaseExt.get('browsingEndDate');
            }
        }
        return { startDate, endDate };
    };
    // Helper function to clear all announcement indicators
    const clearAnnouncementIndicators = () => {
        const calendarDays = document.querySelectorAll('[data-test-calendar-month-day]');
        calendarDays.forEach(day => {
            const indicator = day.querySelector('.announcement-indicator');
            if (indicator) {
                indicator.remove();
            }
        });
    };
    // Helper function to add announcement indicators to calendar days
    const addAnnouncementIndicators = (announcementsByDate) => {
        clearAnnouncementIndicators();
        // Add indicators for dates with announcements
        Object.keys(announcementsByDate).forEach(date => {
            const calendarDay = document.querySelector(`[data-test-calendar-month-day="${date}"]`);
            if (calendarDay) {
                const indicator = document.createElement('div');
                indicator.className = 'announcement-indicator';
                indicator.style.width = '7px';
                indicator.style.height = '7px';
                indicator.style.borderRadius = '50%';
                indicator.style.backgroundColor = 'rgb(59 130 246)';
                indicator.style.position = 'absolute';
                indicator.style.top = '5px';
                indicator.style.right = '5px';
                // Make sure the calendar day has position relative for absolute positioning
                if (window.getComputedStyle(calendarDay).position === 'static') {
                    calendarDay.style.position = 'relative';
                }
                calendarDay.appendChild(indicator);
            }
        });
    };
    // Common function to fetch and process announcements
    const fetchAndProcessAnnouncements = (shouldDisplayCard = false, selectedDate) => {
        const activityId = getActivityId();
        const { startDate, endDate } = getBrowsingDates();
        // Check if we already made this request
        if (lastRequestParams &&
            lastRequestParams.activityId === activityId &&
            lastRequestParams.startDate === startDate &&
            lastRequestParams.endDate === endDate) {
            console.log('[Extension code]: Using cached announcements data');
            // If we need to display the card and we have cached data
            if (shouldDisplayCard && Object.keys(cachedAnnouncementsByDate).length > 0) {
                displayAnnouncements(cachedAnnouncementsByDate, selectedDate);
            }
            return;
        }
        // Update last request params
        lastRequestParams = { activityId, startDate, endDate };
        // Fetch announcements
        fetchAnnouncements(activityId, startDate, endDate, shouldDisplayCard);
    };
    // Subscribe to selected purchase date updates
    this.subscribeToAppEvent('CalendarComponent.selectedPurchaseDate.update', (event) => {
        console.log('[Extension code]: Announcements - selectedPurchaseDate on Ember', event);
        // Get the date from the purchase extension
        const date = shoppingCartService.purchaseExt.get('date');
        console.log('[Extension code]: Selected purchase date', date);
        // Fetch and display announcements with card
        fetchAndProcessAnnouncements(true, date);
    });
    // Subscribe to availability updates
    this.subscribeToAppEvent('CalendarComponent.hasAvailability.update', (event) => {
        console.log('[Extension code]: Announcements - hasAvailability on Ember', event);
        // Fetch announcements but don't display card, just update indicators
        fetchAndProcessAnnouncements(false);
    });
    // Subscribe to date-change events on ember
    this.subscribeToAppEvent('ActivitySlotListComponent.activitySlotDates.update', (event) => {
        console.log('[Extension code]: Announcements - date changed on Ember', event, event.data.value);
        if (event?.data?.value?.length > 0) {
            // Get the selected dates from the event
            const selectedDates = event.data.value.map(date => date.templateDate);
            // Format dates for the API (YYYY-MM-DD)
            const startDate = selectedDates[0] || moment().format('YYYY-MM-DD');
            const endDate = selectedDates[selectedDates.length - 1] || moment().add(1, 'month').format('YYYY-MM-DD');
            // Get the activity ID
            const activityId = getActivityId();
            // Fetch announcements
            fetchAnnouncements(activityId, startDate, endDate, true);
        }
    });
    /**
     * Fetch announcements from the API
     * @param activityId The activity ID to fetch announcements for
     * @param startDate The start date in YYYY-MM-DD format
     * @param endDate The end date in YYYY-MM-DD format
     * @param shouldDisplayCard Whether to display announcement cards or just add indicators
     */
    function fetchAnnouncements(activityId, startDate, endDate, shouldDisplayCard = false) {
        console.log(`[Extension code]: Fetching announcements for activity ${activityId} from ${startDate} to ${endDate}`);
        // Use the labs proxy to make the request
        const url = `/services/labs/booking-flow-announcements/peek-pro/api/announcements?activity_ids=${activityId}&start_date=${startDate}&end_date=${endDate}`;
        fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Peek-Auth': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJKb2tlbiIsImN1cnJlbnRfdXNlcl9lbWFpbCI6bnVsbCwiY3VycmVudF91c2VyX2lkIjpudWxsLCJjdXJyZW50X3VzZXJfaXNfcGVla19hZG1pbiI6bnVsbCwiY3VycmVudF91c2VyX25hbWUiOiJob29rIiwiY3VycmVudF91c2VyX3ByaW1hcnlfcm9sZSI6bnVsbCwiZXhwIjoxNzQ4MjU1NTk3LCJpYXQiOjE3NDcxNDU1MzcsImlzcyI6InBlZWtfYXBwX3NkayIsImp0aSI6IjMwdmhuNzAxcXJoODB0MTJwazAwMDFuMSIsIm5iZiI6MTc0NzE0NTUzNywic3ViIjoiZmM2NjBiZTEtMWIyMC00MDJhLThhZjktMWVkOWI5MTQwYzY0In0.rvmDRL9A1UNArcrCMudHQlki_e8_GigDtRczWk492lQ'
            }
        })
            .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
            .then(data => {
            console.log('[Extension code]: Announcements data received:', data);
            // Process the announcements
            if (data && Array.isArray(data)) {
                // Organize announcements by date
                const announcementsByDate = {};
                data.forEach((announcement) => {
                    // Each announcement can have multiple dates
                    announcement.dates.forEach(date => {
                        if (!announcementsByDate[date]) {
                            announcementsByDate[date] = [];
                        }
                        announcementsByDate[date].push(announcement);
                    });
                });
                // Log the organized announcements
                console.log('[Extension code]: Organized announcements by date:', announcementsByDate);
                // Cache the announcements data for reuse
                cachedAnnouncementsByDate = announcementsByDate;
                // Add blue dot indicators to calendar days with announcements
                addAnnouncementIndicators(announcementsByDate);
                // Display the announcements cards only if requested
                if (shouldDisplayCard) {
                    displayAnnouncements(announcementsByDate);
                }
            }
            else {
                console.error('[Extension code]: Invalid announcements data format');
            }
        })
            .catch(error => {
            console.error('[Extension code]: Error fetching announcements:', error);
        });
    }
    /**
     * Display announcements in the UI
     * @param announcementsByDate Announcements organized by date
     */
    const displayAnnouncements = (announcementsByDate, selectedDate) => {
        // Check if we have any announcements
        const dates = Object.keys(announcementsByDate);
        if (dates.length === 0) {
            console.log('[Extension code]: No announcements found for the selected dates');
            return;
        }
        // Find all elements with data-activity-slot-list attributes
        const slotElements = document.querySelectorAll('[data-activity-slot-list]');
        console.log(`[Extension code]: Found ${slotElements.length} slot elements`);
        // Process each date with announcements
        dates.forEach(date => {
            // if a selectedDate is provided we are in a calendar type booking flow, only do it once
            if (selectedDate && date !== selectedDate) {
                return;
            }
            const announcements = announcementsByDate[date];
            let selector = '[data-ember-extension-end-calendar-placeholder]';
            if (!selectedDate) {
                selector = `[data-activity-slot-list="${date}"]`;
            }
            console.log('[Extension code]: Selector', selector);
            const matchingSlotElements = document.querySelectorAll(selector);
            if (matchingSlotElements.length > 0) {
                console.log(`[Extension code]: Found ${matchingSlotElements.length} matching elements for date ${date}`);
                // Add announcement cards to each matching element
                matchingSlotElements.forEach(slotElement => {
                    // Remove any existing announcements for this slot
                    const existingAnnouncement = slotElement.querySelector('[data-test-extension-announcement]');
                    if (existingAnnouncement) {
                        existingAnnouncement.remove();
                    }
                    // Create and add the announcement card
                    const formattedDate = moment(date).format('MMM D');
                    createAnnouncementCard(slotElement, formattedDate, announcements);
                });
            }
            else {
                console.log(`[Extension code]: No matching slot element found for date ${date}`);
            }
        });
    };
    /**
     * Create a product card for announcements
     * @param container The container to add the card to
     * @param announcements The announcements for this date
     */
    function createAnnouncementCard(container, formattedDate, announcements) {
        const cardWrapper = document.createElement('div');
        cardWrapper.style.margin = '1rem';
        cardWrapper.setAttribute('data-test-extension-announcement', '');
        const htmlContent = announcements.map(a => '<b>' + formattedDate + '</b>: ' + markdown.toHTML(a.body)).join('<div class="announcements-ext-dot-separator"></div>');
        const card = document.createElement('il-product-card');
        card.setAttribute('data-extension-web-component', 'il-product-card');
        card.isSelected = true;
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'announcements-ext-scrollable-content';
        contentWrapper.innerHTML = htmlContent;
        card.appendChild(contentWrapper);
        cardWrapper.appendChild(card);
        container.appendChild(cardWrapper);
        const shadow = card.shadowRoot;
        const style = document.createElement('style');
        style.textContent =
            ` .il-product-card {
        background: #F0F9FF !important;
      }
      `;
        shadow.appendChild(style);
    }
}
//# sourceMappingURL=index.js.map