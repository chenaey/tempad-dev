export default defineUnlistedScript(async () => {
	const markers = [
		'delete window.figma',
		'.createAPI()'
	]

	const current = document.currentScript as HTMLScriptElement
	const src = current.src

	function replaceScript(src: string) {
		const script = document.createElement('script');
		script.src = src;
		script.defer = true;
		current.replaceWith(script);
	}

	function matchFile(content: string) {
		return markers.every((marker) => content.includes(marker))
	}

	try {
		let content = await (await fetch(src)).text()

		if (matchFile(content)) {
			content = content.replace(/if\(!([a-zA-Z\d]+)\.userID\|\|/, 'if(true){}else if(!$1.userID||')
		}

		// document.currentScript will be `null` if we run with `new Function()`
		content = content.replaceAll('document.currentScript.src', `"${src}"`)

		new Function(content)()
	} catch (_) {
		replaceScript(`${src}?fallback`)
	}
})
