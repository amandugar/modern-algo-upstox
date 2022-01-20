"use strict"

var apiServer = "https://api.upstox.com"
var cookieName = "upstoxApiAccessToken"
var processOrderServer = "https://core.upstox.com/order"
var payinpayoutServer = "https://core.upstox.com/payinpayout"
var socketUrl = "wss://ws-api.upstox.com/"
var Upstox = (function () {
  function Upstox(apiKey, redirectUri) {
    var _this = this
    var positionCss
    if (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
    ) {
      positionCss = "top:0;height:100%;width:100%;right:0;"
    } else if (
      document.documentElement.clientWidth < 500 &&
      document.documentElement.clientHeight > 550
    ) {
      positionCss = "top:50%;height:550px;margin-top:-275px;width:100%;right:0;"
    } else if (
      document.documentElement.clientHeight <= 550 &&
      document.documentElement.clientWidth > 500
    ) {
      positionCss =
        "top:0;height:100%;width:320px;right:50%;margin-right:-160px;"
    } else if (
      document.documentElement.clientHeight <= 550 &&
      document.documentElement.clientWidth <= 500
    ) {
      positionCss = "top:0;height:100%;width:100%;right:0;"
    } else {
      positionCss =
        "top:50%;height:550px;margin-top:-275px;width:320px;right:50%;margin-right:-160px;"
    }
    this.accessToken = this.getCookie(cookieName) || ""
    this.apiKey = apiKey
    this.redirectUri = redirectUri
    this.processOrderAfterLogin = null
    this.socketObject = { socket: null, callbacks: [] }
    this.upstoxContainer = document.createElement("div")
    this.upstoxContainer.setAttribute(
      "style",
      "display:none;position:fixed;top:0;left:0;height:100%;width:100%;z-index:2147483647;background:rgba(0,0,0,0.75);text-align:center;"
    )
    this.loaderStyle = document.createElement("style")
    this.loaderStyle.innerHTML =
      ".core-sdk-loading {" +
      "color: transparent;" +
      "position: relative;" +
      "}" +
      ".core-sdk-loading:after {" +
      'content: "";' +
      "margin-top: -11px;" +
      "margin-left: -8px;" +
      "position: absolute;" +
      "top: 50%;" +
      "z-index: -1;" +
      "border: 2px solid #ffffff;" +
      "border-top-color: rgba(0, 0, 0, 0)!important;" +
      "border-left-color: rgba(0, 0, 0, 0)!important;" +
      "width: 16px;" +
      "background: none!important;" +
      "height: 16px;" +
      "border-radius: 50%;" +
      "animation: loadingSpinner .6s infinite linear;" +
      "}" +
      "@keyframes loadingSpinner {" +
      "from {" +
      "transform: rotate(0deg);" +
      "}" +
      "to {" +
      "transform: rotate(360deg);" +
      "}" +
      "}"
    this.upstoxContainer.classList.add("core-sdk-loading")
    document.body.appendChild(this.loaderStyle)
    this.loginIFrameEl = document.createElement("iframe")
    this.loginIFrameEl.setAttribute(
      "style",
      "display:none;position:absolute;border:none;padding:0;margin:0 auto;transform:scale(0.9);-webkit-transition: .3s cubic-bezier(.3,1.5,.7,1) transform;-o-transition: .3s cubic-bezier(.3,1.5,.7,1) transform;transition: .3s cubic-bezier(.3,1.5,.7,1) transform;" +
        positionCss
    )
    this.loginIFrameEl.setAttribute("src", "")
    this.upstoxContainer.appendChild(this.loginIFrameEl)
    document.body.appendChild(this.upstoxContainer)
    this.processOrderIFrameEl = document.createElement("iframe")
    this.processOrderIFrameEl.setAttribute(
      "style",
      "display:none;position:absolute;border:none;padding:0;margin:0 auto;transform:scale(0.9);-webkit-transition: .3s cubic-bezier(.3,1.5,.7,1) transform;-o-transition: .3s cubic-bezier(.3,1.5,.7,1) transform;transition: .3s cubic-bezier(.3,1.5,.7,1) transform;" +
        positionCss
    )
    this.processOrderIFrameEl.setAttribute("src", "")
    this.upstoxContainer.appendChild(this.processOrderIFrameEl)
    document.body.appendChild(this.upstoxContainer)
    window.addEventListener(
      "message",
      function (e) {
        switch (e.data.type) {
          case "access_token":
            _this.upstoxContainer.style.display = "none"
            _this.loginIFrameEl.style.display = "none"
            _this.accessToken = e.data.accessToken
            _this.setCookie(cookieName, _this.accessToken, 6)
            _this.loginPromiseObject.resolve({
              code: 200,
              message: "Login successful",
              data: {
                userDetails: e.data.user_details,
                customDetails: e.data.custom_details,
              },
            })
            break
          case "process_order_response":
          case "close_upstox_iframe":
            _this.closeUpstoxFrame()
            _this.closeSocket(_this.socketOrderUpdates)
            if (e.data && _this.processOrderPromiseObject) {
              _this.processOrderPromiseObject.resolve(e.data.orderData)
            } else if (
              _this.loginPromiseObject ||
              _this.processOrderPromiseObject
            ) {
              var promise =
                _this.loginPromiseObject || _this.processOrderPromiseObject
              promise.resolve({ type: "close_upstox_iframe" })
            }
            break
          case "error_response":
            _this.closeUpstoxFrame()
            _this.closeSocket(_this.socketOrderUpdates)
            if (e.data) {
              _this.processOrderPromiseObject.reject(e.data.error)
            }
            break
        }
      },
      false
    )
  }
  Upstox.prototype.login = function (userId) {
    var _this = this
    this.loginIFrameEl.setAttribute(
      "src",
      apiServer +
        "/index/dialog/authorize?apiKey=" +
        this.apiKey +
        "&redirect_uri=" +
        this.redirectUri +
        "&response_type=code&user_id=" +
        userId
    )
    this.upstoxContainer.style.display = "block"
    this.loginIFrameEl.onload = function () {
      _this.loginIFrameEl.style.display = "block"
      setTimeout(function () {
        return (_this.loginIFrameEl.style.transform = "none")
      }, 100)
      _this.loginIFrameEl.contentWindow.postMessage(
        { type: "close_upstox_iframe" },
        "*"
      )
    }
    this.loginPromiseObject = this.defer()
    return this.loginPromiseObject.promise
  }
  Upstox.prototype.placeOrder = function (order) {
    var _this = this
    this.processOrderPromiseObject = this.defer()
    if (this.accessToken !== "") {
      this.openPlaceOrderFrame(order)
    } else {
      var loginPromise = this.login()
      loginPromise.then(function (resp) {
        if (resp.code === 200) {
          _this.openPlaceOrderFrame(order)
        }
      })
    }
    return this.processOrderPromiseObject.promise
  }
  Upstox.prototype.openPlaceOrderFrame = function (order) {
    var _this = this
    if (order && !Array.isArray(order)) order = [order]
    this.processOrderIFrameEl.setAttribute(
      "src",
      processOrderServer + "?cta=place_order"
    )
    this.upstoxContainer.style.display = "block"
    this.processOrderIFrameEl.onload = function () {
      _this.processOrderIFrameEl.style.display = "block"
      setTimeout(function () {
        return (_this.processOrderIFrameEl.style.transform = "none")
      }, 100)
      _this.processOrderIFrameEl.contentWindow.postMessage(
        {
          type: "process_order",
          accessToken: _this.accessToken,
          apiKey: _this.apiKey,
          order: order,
        },
        "*"
      )
      _this.connectSocket(_this.socketOrderUpdates)
    }
  }
  Upstox.prototype.socketOrderUpdates = function (data) {
    console.log(data)
    this.processOrderIFrameEl.contentWindow.postMessage(
      { type: "order_update", data: data },
      "*"
    )
  }
  Upstox.prototype.modifyOrder = function (orderId) {
    var _this = this
    this.processOrderPromiseObject = this.defer()
    if (this.accessToken !== "") {
      this.openModifyOrderFrame(orderId)
    } else {
      var loginPromise = this.login()
      loginPromise.then(function (resp) {
        if (resp.code === 200) {
          _this.openModifyOrderFrame(orderId)
        }
      })
    }
    return this.processOrderPromiseObject.promise
  }
  Upstox.prototype.openModifyOrderFrame = function (orderId) {
    var _this = this
    this.processOrderIFrameEl.setAttribute(
      "src",
      processOrderServer + "?cta=modify_order"
    )
    this.upstoxContainer.style.display = "block"
    this.processOrderIFrameEl.onload = function () {
      _this.processOrderIFrameEl.style.display = "block"
      setTimeout(function () {
        return (_this.processOrderIFrameEl.style.transform = "none")
      }, 100)
      _this.getOrderDetails(orderId).then(function (order) {
        _this.processOrderIFrameEl.contentWindow.postMessage(
          {
            type: "process_order",
            accessToken: _this.accessToken,
            apiKey: _this.apiKey,
            order: order.data[0],
          },
          "*"
        )
      })
      _this.connectSocket(_this.socketOrderUpdates)
    }
  }
  Upstox.prototype.cancelOrder = function (orderId) {
    var _this = this
    this.processOrderPromiseObject = this.defer()
    if (this.accessToken !== "") {
      this.openCancelOrderFrame(orderId)
    } else {
      var loginPromise = this.login()
      loginPromise.then(function (resp) {
        if (resp.code === 200) {
          _this.openCancelOrderFrame(orderId)
        }
      })
    }
    return this.processOrderPromiseObject.promise
  }
  Upstox.prototype.openCancelOrderFrame = function (orderId) {
    var _this = this
    this.processOrderIFrameEl.setAttribute(
      "src",
      processOrderServer + "?cta=cancel_order"
    )
    this.upstoxContainer.style.display = "block"
    this.processOrderIFrameEl.onload = function () {
      _this.processOrderIFrameEl.style.display = "block"
      setTimeout(function () {
        return (_this.processOrderIFrameEl.style.transform = "none")
      }, 100)
      _this.getOrderDetails(orderId).then(function (order) {
        _this.processOrderIFrameEl.contentWindow.postMessage(
          {
            type: "process_order",
            accessToken: _this.accessToken,
            apiKey: _this.apiKey,
            order: order.data[0],
          },
          "*"
        )
      })
      _this.connectSocket(_this.socketOrderUpdates)
    }
  }
  Upstox.prototype.getProfile = function () {
    var _this = this
    var getProfilePromise = this.defer()
    if (this.accessToken !== "") {
      getProfilePromise.promise = this.getProfileRequest()
    } else {
      var loginPromise = this.login()
      loginPromise.then(function (resp) {
        if (resp.code === 200) {
          _this.getProfileRequest().then(function (resp) {
            getProfilePromise.resolve(resp)
          })
        }
      })
    }
    return getProfilePromise.promise
  }
  Upstox.prototype.getProfileRequest = function () {
    var headers = {
      headers: {
        authorization: "Bearer " + this.accessToken,
        "x-api-key": this.apiKey,
      },
    }
    return request("get", apiServer + "/index/profile", {}, null, headers).then(
      function (response) {
        return response.json()
      }
    )
  }
  Upstox.prototype.getBalance = function () {
    var _this = this
    var getBalancePromise = this.defer()
    if (this.accessToken !== "") {
      getBalancePromise.promise = this.getBalanceRequest()
    } else {
      var loginPromise = this.login()
      loginPromise.then(function (resp) {
        if (resp.code === 200) {
          _this.getBalanceRequest().then(function (resp) {
            getBalancePromise.resolve(resp)
          })
        }
      })
    }
    return getBalancePromise.promise
  }
  Upstox.prototype.getBalanceRequest = function () {
    var headers = {
      headers: {
        authorization: "Bearer " + this.accessToken,
        "x-api-key": this.apiKey,
      },
    }
    return request(
      "get",
      apiServer + "/live/profile/balance",
      {},
      null,
      headers
    ).then(function (response) {
      return response.json()
    })
  }
  Upstox.prototype.getPositions = function () {
    var _this = this
    var getPositionsPromise = this.defer()
    if (this.accessToken !== "") {
      getPositionsPromise.promise = this.getPositionsRequest()
    } else {
      var loginPromise = this.login()
      loginPromise.then(function (resp) {
        if (resp.code === 200) {
          _this.getPositionsRequest().then(function (resp) {
            getPositionsPromise.resolve(resp)
          })
        }
      })
    }
    return getPositionsPromise.promise
  }
  Upstox.prototype.getPositionsRequest = function () {
    var headers = {
      headers: {
        authorization: "Bearer " + this.accessToken,
        "x-api-key": this.apiKey,
      },
    }
    return request(
      "get",
      apiServer + "/live/profile/positions",
      {},
      null,
      headers
    ).then(function (response) {
      return response.json()
    })
  }
  Upstox.prototype.getHoldings = function () {
    var _this = this
    var getHoldingsPromise = this.defer()
    if (this.accessToken !== "") {
      getHoldingsPromise.promise = this.getHoldingsRequest()
    } else {
      var loginPromise = this.login()
      loginPromise.then(function (resp) {
        if (resp.code === 200) {
          _this.getHoldingsRequest().then(function (resp) {
            getHoldingsPromise.resolve(resp)
          })
        }
      })
    }
    return getHoldingsPromise.promise
  }
  Upstox.prototype.getHoldingsRequest = function () {
    var headers = {
      headers: {
        authorization: "Bearer " + this.accessToken,
        "x-api-key": this.apiKey,
      },
    }
    return request(
      "get",
      apiServer + "/live/profile/holdings",
      {},
      null,
      headers
    ).then(function (response) {
      return response.json()
    })
  }
  Upstox.prototype.getOrders = function () {
    var _this = this
    var getOrdersPromise = this.defer()
    if (this.accessToken !== "") {
      getOrdersPromise.promise = this.getOrdersRequest()
    } else {
      var loginPromise = this.login()
      loginPromise.then(function (resp) {
        if (resp.code === 200) {
          _this.getOrdersRequest().then(function (resp) {
            getOrdersPromise.resolve(resp)
          })
        }
      })
    }
    return getOrdersPromise.promise
  }
  Upstox.prototype.getOrdersRequest = function () {
    var headers = {
      headers: {
        authorization: "Bearer " + this.accessToken,
        "x-api-key": this.apiKey,
      },
    }
    return request("get", apiServer + "/live/orders", {}, null, headers).then(
      function (response) {
        return response.json()
      }
    )
  }
  Upstox.prototype.addFunds = function (segment) {
    var _this = this
    this.processOrderPromiseObject = this.defer()
    if (this.accessToken !== "") {
      this.openAddFundsFrame(segment)
    } else {
      var loginPromise = this.login()
      loginPromise.then(function (resp) {
        if (resp.code === 200) {
          _this.openAddFundsFrame(segment)
        }
      })
    }
    return this.processOrderPromiseObject.promise
  }
  Upstox.prototype.openAddFundsFrame = function (segment) {
    var _this = this
    this.processOrderIFrameEl.setAttribute(
      "src",
      payinpayoutServer + "?cta=add_funds"
    )
    this.upstoxContainer.style.display = "block"
    this.processOrderIFrameEl.onload = function () {
      _this.processOrderIFrameEl.style.display = "block"
      setTimeout(function () {
        return (_this.processOrderIFrameEl.style.transform = "none")
      }, 100)
      _this.processOrderIFrameEl.contentWindow.postMessage(
        {
          type: "payin_payout",
          accessToken: _this.accessToken,
          apiKey: _this.apiKey,
          segment: segment,
        },
        "*"
      )
    }
  }
  Upstox.prototype.withdrawFunds = function (segment) {
    var _this = this
    this.processOrderPromiseObject = this.defer()
    if (this.accessToken !== "") {
      this.openWithdrawFundsFrame(segment)
    } else {
      var loginPromise = this.login()
      loginPromise.then(function (resp) {
        if (resp.code === 200) {
          _this.openWithdrawFundsFrame(segment)
        }
      })
    }
    return this.processOrderPromiseObject.promise
  }
  Upstox.prototype.openWithdrawFundsFrame = function (segment) {
    var _this = this
    this.processOrderIFrameEl.setAttribute(
      "src",
      payinpayoutServer + "?cta=withdraw_funds"
    )
    this.upstoxContainer.style.display = "block"
    this.processOrderIFrameEl.onload = function () {
      _this.processOrderIFrameEl.style.display = "block"
      setTimeout(function () {
        return (_this.processOrderIFrameEl.style.transform = "none")
      }, 100)
      _this.processOrderIFrameEl.contentWindow.postMessage(
        {
          type: "payin_payout",
          accessToken: _this.accessToken,
          apiKey: _this.apiKey,
          segment: segment,
        },
        "*"
      )
    }
  }
  Upstox.prototype.connectSocket = function (callback) {
    var _this = this
    this.socketObject.callbacks.push(callback)
    if (!this.socketObject.socket) {
      this.socketObject.socket = new WebSocket(
        socketUrl + "?apiKey=" + this.apiKey + "&token=" + this.accessToken
      )
      this.socketObject.socket.addEventListener("open", function (event) {
        console.log("Hello Upstox Socket!")
      })
      this.socketObject.socket.addEventListener("message", function (event) {
        console.log("Message from server ", event.data)
        console.log(_this)
        for (
          var _i = 0, _a = _this.socketObject.callbacks;
          _i < _a.length;
          _i++
        ) {
          var callback_1 = _a[_i]
          var data = JSON.parse(event.data)
          if (data.message === "order_update") callback_1.call(_this, data.data)
        }
      })
    }
  }
  Upstox.prototype.closeSocket = function (callback) {
    if (this.socketObject.socket) {
      var idx = this.socketObject.callbacks.indexOf(callback)
      if (idx !== -1) this.socketObject.callbacks.splice(idx, 1)
      if (!this.socketObject.callbacks.length) {
        this.socketObject.socket.close()
        this.socketObject.socket = null
      }
    }
  }
  Upstox.prototype.logout = function () {
    var _this = this
    var headers = {
      headers: {
        authorization: "Bearer " + this.accessToken,
        "x-api-key": this.apiKey,
      },
    }
    return request("get", apiServer + "/index/logout", {}, null, headers).then(
      function (response) {
        _this.eraseCookie(cookieName)
        _this.accessToken = ""
        return response.json()
      }
    )
  }
  Upstox.prototype.closeUpstoxFrame = function () {
    this.upstoxContainer.style.display = "none"
    this.loginIFrameEl.style.display = "none"
    this.processOrderIFrameEl.style.display = "none"
  }
  Upstox.prototype.getOrderDetails = function (orderId) {
    var headers = {
      headers: {
        authorization: "Bearer " + this.accessToken,
        "x-api-key": this.apiKey,
      },
    }
    return request(
      "get",
      apiServer + "/live/orders/" + orderId,
      {},
      null,
      headers
    ).then(function (response) {
      return response.json()
    })
  }
  Upstox.prototype.defer = function () {
    var deferred = { promise: null, resolve: null, reject: null }
    deferred.promise = new Promise(function (resolve, reject) {
      deferred.resolve = resolve
      deferred.reject = reject
    })
    return deferred
  }
  Upstox.prototype.setCookie = function (name, value, hours) {
    var expires = ""
    if (hours) {
      var date = new Date()
      date.setTime(date.getTime() + hours * 60 * 60 * 1e3)
      expires = "; expires=" + date.toUTCString()
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/"
  }
  Upstox.prototype.getCookie = function (name) {
    var nameEQ = name + "="
    var ca = document.cookie.split(";")
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i]
      while (c.charAt(0) == " ") c = c.substring(1, c.length)
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length)
    }
    return null
  }
  Upstox.prototype.eraseCookie = function (name) {
    document.cookie = name + "=; Max-Age=-99999999;"
  }
  Upstox.SECURITIES = "S"
  Upstox.COMMODITIES = "C"
  return Upstox
})()

var DEFAULT_REQUEST_OPTIONS = {
  ignoreCache: false,
  headers: { Accept: "application/json, text/javascript, text/plain" },
  timeout: 5e3,
}
function queryParams(params) {
  if (params === void 0) {
    params = {}
  }
  return Object.keys(params)
    .map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k])
    })
    .join("&")
}
function withQuery(url, params) {
  if (params === void 0) {
    params = {}
  }
  var queryString = queryParams(params)
  return queryString
    ? url + (url.indexOf("?") === -1 ? "?" : "&") + queryString
    : url
}
function parseXHRResult(xhr) {
  return {
    ok: xhr.status >= 200 && xhr.status < 300,
    status: xhr.status,
    statusText: xhr.statusText,
    headers: xhr.getAllResponseHeaders(),
    data: xhr.responseText,
    json: function () {
      return JSON.parse(xhr.responseText)
    },
  }
}
function errorResponse(xhr, message) {
  if (message === void 0) {
    message = null
  }
  return {
    ok: false,
    status: xhr.status,
    statusText: xhr.statusText,
    headers: xhr.getAllResponseHeaders(),
    data: message || xhr.statusText,
    json: function () {
      return JSON.parse(message || xhr.statusText)
    },
  }
}
function request(method, url, queryParams, body, options) {
  if (queryParams === void 0) {
    queryParams = {}
  }
  if (body === void 0) {
    body = null
  }
  if (options === void 0) {
    options = DEFAULT_REQUEST_OPTIONS
  }
  var ignoreCache = options.ignoreCache || DEFAULT_REQUEST_OPTIONS.ignoreCache
  var headers = options.headers || DEFAULT_REQUEST_OPTIONS.headers
  var timeout = options.timeout || DEFAULT_REQUEST_OPTIONS.timeout
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest()
    xhr.open(method, withQuery(url, queryParams))
    if (headers) {
      Object.keys(headers).forEach(function (key) {
        return xhr.setRequestHeader(key, headers[key])
      })
    }
    if (ignoreCache) {
      xhr.setRequestHeader("Cache-Control", "no-cache")
    }
    xhr.timeout = timeout
    xhr.onload = function (evt) {
      resolve(parseXHRResult(xhr))
    }
    xhr.onerror = function (evt) {
      resolve(errorResponse(xhr, "{error:'Failed to make request.'}"))
    }
    xhr.onreadystatechange = function (oEvent) {
      if (xhr.readyState === 4) {
        if (xhr.status !== 200) {
          resolve(errorResponse(xhr, xhr.responseText))
        }
      }
    }
    xhr.ontimeout = function (evt) {
      resolve(
        errorResponse(xhr, "{error:'Request took longer than expected.'}")
      )
    }
    if ((method === "post" || method === "put") && body) {
      xhr.setRequestHeader("Content-Type", "application/json")
      xhr.send(JSON.stringify(body))
    } else {
      xhr.send()
    }
  })
}
