window.SETTINGS = {}

const WIKIDATA_API_URL =
    "https://query.wikidata.org/bigdata/namespace/wdq/sparql?format=json&query="
import {apiURL, generateExhibitionDescriptionFromWikipedia} from "./collect.js"
import {setup, animate, render} from "./render.js"
import {setupMultiplayer, setName, setColor, setFace} from "./multiplayer.js"
import {timeStart, timeEnd, timeReset, timeDump} from "./utils.js"

var domain
var topicStack

String.prototype.trunc =
    String.prototype.trunc ||
    function (n) {
        return this.length > n ? this.substr(0, n - 1) + "&hellip;" : this
    }

async function getSuggestions(value) {
    window
        .fetch(
            `${await apiURL(
                domain
            )}?action=opensearch&format=json&formatversion=2&search=${value}&namespace=0&limit=10&origin=*`
        )
        .then((response) => {
            response.json().then(function (data) {
                let datalist = document.getElementById("suggestions")
                datalist.innerHTML = ""

                for (let item of data[1]) {
                    addOption(item)
                }
            })
        })
}

async function randomSuggestions() {
    window
        .fetch(
            `${await apiURL(
                domain
            )}?action=query&format=json&list=random&rnlimit=10&rnnamespace=0&origin=*`
        )
        .then((response) => {
            response.json().then(function (data) {
                let datalist = document.getElementById("suggestions")
                datalist.innerHTML = ""

                for (let item of data.query.random) {
                    addOption(item.title)
                }
            })
        })
}

function goodSuggestions() {
    let datalist = document.getElementById("suggestions")
    datalist.innerHTML = ""

    addOption("Kangaroo")
    addOption("Ada Lovelace")
    addOption("Elementary particle")
    addOption("Optical illusion")
    addOption("Camera obscura")
    addOption("Leonardo da Vinci")
    addOption("Mammal")
}

function addOption(label) {
    let datalist = document.getElementById("suggestions")
    let option = document.createElement("option")

    option.value = `${label}`
    datalist.appendChild(option)
}

function addFaceOption(label) {
    let datalist = document.getElementById("face-suggestions")
    let option = document.createElement("option")

    option.value = `${label}`
    datalist.appendChild(option)
}

export function updateStatus(text) {
    document.querySelector("#status").innerHTML = text
}

function startGeneration() {
    let domainDiv = document.getElementById("language")
    domain = domainDiv.value

    let topicDiv = document.getElementById("topic")
    topicDiv.blur()

    let topic = topicDiv.value

    console.log(domain)
    let url = `${domain}/wiki/${topic}`
    localStorage.setItem("url", url)
    generateExhibition(url)
}

async function startRandom() {
    window
        .fetch(
            `${await apiURL(
                domain
            )}?action=query&format=json&list=random&rnlimit=1&rnnamespace=0&origin=*`
        )
        .then((response) => {
            response.json().then(function (data) {
                generateExhibition(
                    `${domain}/wiki/${data.query.random[0].title}`
                )
            })
        })
}

function pickCorrectDomainOption(url) {
    let regex = /^(https:\/\/[^\/]*)\/(wiki\/)?([^#]*)$/
    let match = url.match(regex)

    if (match) {
        domain = match[1]
        let topic = match[2]
        console.log(domain)
        // Scan through available options and check whether domain is one of them.
        let languageSelect = document.getElementById("language")
        console.log(languageSelect.children)
        languageSelect.selectedIndex = -1
        for (let i = 0; i < languageSelect.children.length; i++) {
            if (languageSelect.children[i].value === domain) {
                languageSelect.selectedIndex = i
                break
            }
        }
        console.log(languageSelect.selectedIndex)
        if (languageSelect.selectedIndex === -1) {
            let option = document.createElement("option")
            option.innerHTML = domain
            option.value = domain
            languageSelect.appendChild(option)
            languageSelect.value = domain
        }

        document.getElementById("language").value = domain
        document.getElementById("topic").value = topic
    }
}

export async function generateExhibition(url) {
    if (url.startsWith("/")) {
        url = `${domain}${url}`
    }

    console.log(url)
    let matches = url.match(/^(https:\/\/[^\/]*)\/(wiki\/)?([^?]+)(\?.*)?$/)
    console.log(matches)

    domain = matches[1]
    let topic = matches[3]

    let api = await apiURL(domain)

    if (!api) {
        window.open(url, "_blank")
        return
    }

    pickCorrectDomainOption(url)

    if (topicStack[topicStack.length - 1] === url) {
        // The user likely refreshed the page, do nothing.
    } else if (topicStack[topicStack.length - 2] === url) {
        // The user likely clicked on the "back" sign.
        topicStack.pop()
    } else {
        topicStack.push(url)
    }
    var previousTopic = topicStack[topicStack.length - 2]
    localStorage.setItem("topicStack", JSON.stringify(topicStack))

    let topicDiv = document.getElementById("topic")
    topicDiv.value = topic

    window.SETTINGS = {
        lights: document.querySelector("#lights")?.checked || false,
        shadows: document.querySelector("#shadows")?.checked || false,
        textures: document.querySelector("#textures")?.checked || false,
        images: document.querySelector("#images")?.checked || true,
        texts: document.querySelector("#texts")?.checked || true,
    }

    timeReset()

    var t = timeStart("entire generation")
    updateStatus("Generating...")

    location.hash = url

    var exhibition = await generateExhibitionDescriptionFromWikipedia(
        topic,
        domain
    )
    exhibition.previous = previousTopic
    await initializeMultiplayer(exhibition.name)
    await render(exhibition)
    timeEnd(t)

    timeDump()
}

async function initializeMultiplayer(topic) {
    await setupMultiplayer(topic)

    // Trigger input events.
    document.getElementById("name").dispatchEvent(new Event("input"))
    document.getElementById("face").dispatchEvent(new Event("input"))
    document.getElementById("color").dispatchEvent(new Event("input"))
}

async function runQuery(query) {
    query = query.replace(/%/g, "%25")
    query = query.replace(/&/g, "%26")

    let response = await window.fetch(WIKIDATA_API_URL + query)

    if (response.status !== 200) {
        updateStatus(
            `The query took too long or failed. This is probably a bug, let us know! (Status code: ${response.status})`
        )
        return
    }
    let data = await response.json()
    return data.results.bindings
}

function populateFaceOptions() {
    addFaceOption("^_^")
    addFaceOption("OvO")
    addFaceOption("'o'")
    addFaceOption("-.-")
    addFaceOption("UwU")
}

async function populateLanguageOptions() {
    let select = document.querySelector("select")

    let option = document.createElement("option")
    option.innerHTML = "Wikimedia Commons"
    option.value = "https://commons.wikimedia.org"
    select.appendChild(option)

    const langQuery = `
SELECT ?languageCode ?languageLabel ?records (GROUP_CONCAT(?nativeLabel; SEPARATOR = "/") AS ?nativeLabels) WHERE {
  ?wiki wdt:P31 wd:Q10876391;
    wdt:P424 ?languageCode;
    wdt:P407 ?language.
  OPTIONAL { ?wiki wdt:P4876 ?records. }
  ?language wdt:P1705 ?nativeLabel.
  MINUS { ?wiki wdt:P576 ?when. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?languageCode ?languageLabel ?records ORDER BY DESC(?records)
    `
    let results = await runQuery(langQuery)
    console.log(results)

    for (let line of results) {
        let option = document.createElement("option")
        option.innerHTML =
            `${line.languageLabel.value} (${line.languageCode.value}) – ${line.nativeLabels.value}`.trunc(
                40
            )
        option.value = `https://${line.languageCode.value}.wikipedia.org`
        select.appendChild(option)
    }

    document.querySelector("#language").value = domain
}

window.onload = async function () {
    await populateLanguageOptions()
    populateFaceOptions()
    document.getElementById("language").addEventListener("change", function () {
        domain = this.value
    })

    document.getElementById("topic").addEventListener("keyup", (e) => {
        if (e.key === "Enter") {
            topicStack = []
            startGeneration()
        }
    })
    document.getElementById("generate-button").addEventListener("click", () => {
        topicStack = []
        startGeneration()
    })
    document
        .getElementById("random-button")
        .addEventListener("click", async function () {
            topicStack = []
            await startRandom()
        })
    document.getElementById("topic").addEventListener("input", async (e) => {
        let text = e.target.value
        if (text === "") {
            //goodSuggestions()
        } else {
            await getSuggestions(text)
        }
    })

    document.getElementById("color").addEventListener("input", (e) => {
        setColor(e.target.value)
        localStorage.setItem("color", e.target.value)
    })

    document.getElementById("name").addEventListener("input", (e) => {
        setName(e.target.value)
        localStorage.setItem("name", e.target.value)
    })

    document.getElementById("face").addEventListener("input", (e) => {
        setFace(e.target.value)
        localStorage.setItem("face", e.target.value)
    })

    //goodSuggestions()

    topicStack = JSON.parse(localStorage.getItem("topicStack") || "[]")

    setup()

    // Pick random color.
    let color =
        localStorage.getItem("color") ||
        "#" +
            Math.floor(Math.random() * 16777215)
                .toString(16)
                .padStart(6, "0")
    document.getElementById("color").value = color

    if (location.hash) {
        // Parse language and topic from Wikipedia URL.
        var url = decodeURIComponent(location.hash.substr(1))
    } else {
        var url = localStorage.getItem("url")
    }
    console.log(url)

    if (url) {
        pickCorrectDomainOption(url)
        generateExhibition(url) // TODO also put in localstorage
    } else {
        domain = "https://en.wikipedia.org"
        await startRandom()
    }

    let name = localStorage.getItem("name") || "squirrel"
    document.getElementById("name").value = name

    let face = localStorage.getItem("face") || "^_^"
    document.getElementById("face").value = face

    animate()
}
