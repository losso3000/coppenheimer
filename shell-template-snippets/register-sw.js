	(async function () {
		let registration = await navigator.serviceWorker
			.register('sw.js')
			.catch((e) => console.error('service worker failed to register:', e));
		if (registration) {
			console.log('service worker registered', registration.scope);
			registration.addEventListener('updatefound', () => {
				console.log('Reloading page to make use of updated service worker.');
				window.location.reload();
			});    
			// If the registration is active, but it's not controlling the page
			if (registration.active && !navigator.serviceWorker.controller) {
				console.log('Reloading page to make use of new service worker.');
				window.location.reload();
			}
		}
	})();
