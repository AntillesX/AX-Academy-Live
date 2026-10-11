--!strict
-- Server-only Supabase REST client for AntillesX Roblox experiences.
-- Put a ModuleScript named `SupabaseConfig` in ServerStorage that returns:
-- { BaseUrl = "https://<project-ref>.supabase.co", ApiKey = "<service-role-key>", Schema = "public" }
-- Never place that config, its API key, or this module under ReplicatedStorage.

local HttpService = game:GetService("HttpService")
local ServerStorage = game:GetService("ServerStorage")

export type Configuration = {
	BaseUrl: string,
	ApiKey: string,
	Schema: string?,
}

export type RequestOptions = {
	query: {[string]: string | number | boolean}?,
	body: any?,
	headers: {[string]: string}?,
	prefer: string?,
}

export type Response = {
	ok: boolean,
	statusCode: number,
	data: any?,
	error: string?,
}

local SupabaseClient = {}
SupabaseClient.__index = SupabaseClient

local function assertString(value: any, label: string)
	if type(value) ~= "string" or value == "" then
		error(string.format("SupabaseClient configuration error: %s must be a non-empty string", label), 3)
	end
end

local function urlEncode(value: string | number | boolean): string
	return HttpService:UrlEncode(tostring(value))
end

local function validateTableName(tableName: string)
	if not string.match(tableName, "^[%a_][%w_]*$") then
		error("SupabaseClient rejected an invalid table name", 3)
	end
end

local function decodeBody(body: string): any?
	if body == "" then
		return nil
	end

	local decoded, decodeError = pcall(function()
		return HttpService:JSONDecode(body)
	end)
	if decoded then
		return decodeError
	end
	return body
end

function SupabaseClient.new(configuration: Configuration)
	assertString(configuration.BaseUrl, "BaseUrl")
	assertString(configuration.ApiKey, "ApiKey")

	local baseUrl = string.gsub(configuration.BaseUrl, "/+$", "")
	if not string.match(baseUrl, "^https://") then
		error("SupabaseClient configuration error: BaseUrl must use HTTPS", 2)
	end

	return setmetatable({
		_baseUrl = baseUrl,
		_apiKey = configuration.ApiKey,
		_schema = configuration.Schema or "public",
	}, SupabaseClient)
end

function SupabaseClient.fromServerStorage()
	local configModule = ServerStorage:FindFirstChild("SupabaseConfig")
	if not configModule or not configModule:IsA("ModuleScript") then
		error("Create ServerStorage.SupabaseConfig before starting AntillesX server systems", 2)
	end

	local configuration = require(configModule)
	return SupabaseClient.new(configuration)
end

function SupabaseClient:_request(method: string, path: string, options: RequestOptions?): Response
	local requestOptions = options or {}
	local queryPairs = {}
	for key, value in pairs(requestOptions.query or {}) do
		table.insert(queryPairs, HttpService:UrlEncode(key) .. "=" .. urlEncode(value))
	end

	local url = self._baseUrl .. path
	if #queryPairs > 0 then
		url ..= "?" .. table.concat(queryPairs, "&")
	end

	local headers = {
		["apikey"] = self._apiKey,
		["Authorization"] = "Bearer " .. self._apiKey,
		["Accept"] = "application/json",
		["Content-Type"] = "application/json",
		["Accept-Profile"] = self._schema,
		["Content-Profile"] = self._schema,
	}
	if requestOptions.prefer then
		headers["Prefer"] = requestOptions.prefer
	end
	for key, value in pairs(requestOptions.headers or {}) do
		headers[key] = value
	end

	local request = {
		Url = url,
		Method = method,
		Headers = headers,
	} :: any
	if requestOptions.body ~= nil then
		request.Body = HttpService:JSONEncode(requestOptions.body)
	end

	local requestSucceeded, rawResponse = pcall(function()
		return HttpService:RequestAsync(request)
	end)
	if not requestSucceeded then
		return {
			ok = false,
			statusCode = 0,
			error = "Supabase request failed: " .. tostring(rawResponse),
		}
	end

	local response = rawResponse
	local decodedBody = decodeBody(response.Body)
	if response.Success then
		return {
			ok = true,
			statusCode = response.StatusCode,
			data = decodedBody,
		}
	end

	local errorMessage = response.StatusMessage
	if type(decodedBody) == "table" then
		errorMessage = decodedBody.message or decodedBody.hint or decodedBody.details or errorMessage
	elseif type(decodedBody) == "string" and decodedBody ~= "" then
		errorMessage = decodedBody
	end

	return {
		ok = false,
		statusCode = response.StatusCode,
		data = decodedBody,
		error = tostring(errorMessage),
	}
end

function SupabaseClient:select(tableName: string, query: {[string]: string | number | boolean}?): Response
	validateTableName(tableName)
	local finalQuery = query or {}
	if finalQuery.select == nil then
		finalQuery.select = "*"
	end
	return self:_request("GET", "/rest/v1/" .. tableName, { query = finalQuery })
end

function SupabaseClient:insert(tableName: string, payload: any): Response
	validateTableName(tableName)
	return self:_request("POST", "/rest/v1/" .. tableName, {
		body = payload,
		prefer = "return=representation",
	})
end

function SupabaseClient:update(tableName: string, query: {[string]: string | number | boolean}, payload: any): Response
	validateTableName(tableName)
	return self:_request("PATCH", "/rest/v1/" .. tableName, {
		query = query,
		body = payload,
		prefer = "return=representation",
	})
end

function SupabaseClient:rpc(functionName: string, payload: any): Response
	if not string.match(functionName, "^[%a_][%w_]*$") then
		error("SupabaseClient rejected an invalid RPC function name", 2)
	end
	return self:_request("POST", "/rest/v1/rpc/" .. functionName, {
		body = payload,
		prefer = "return=representation",
	})
end

return SupabaseClient
