--!strict
-- Client-facing arcade session controller. Require this module from a LocalScript.
-- The server must create ReplicatedStorage.AntillesXRemotes.SubmitArcadeScore and validate every score.
-- Never trust a client-supplied score for XP or wallet updates.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

export type ArcadeConfiguration = {
	gameName: string,
	cameraCFrame: CFrame,
	cameraFieldOfView: number?,
	onScoreChanged: ((score: number) -> ())?,
	onExit: (() -> ())?,
}

export type ArcadeEngine = {
	enter: (self: ArcadeEngine) -> (),
	exit: (self: ArcadeEngine) -> (),
	setScore: (self: ArcadeEngine, score: number) -> (),
	addScore: (self: ArcadeEngine, amount: number) -> (),
	submitScore: (self: ArcadeEngine) -> (),
	isActive: (self: ArcadeEngine) -> boolean,
}

local ArcadeEngine = {}
ArcadeEngine.__index = ArcadeEngine

local function getSubmitRemote(): RemoteEvent
	local remotes = ReplicatedStorage:WaitForChild("AntillesXRemotes", 10)
	if not remotes then
		error("AntillesXRemotes is missing; start the ArcadeScoreService server script", 3)
	end
	local remote = remotes:WaitForChild("SubmitArcadeScore", 10)
	if not remote or not remote:IsA("RemoteEvent") then
		error("SubmitArcadeScore RemoteEvent is missing", 3)
	end
	return remote
end

local function makeOverlay(): ScreenGui
	local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
	local oldOverlay = playerGui:FindFirstChild("AntillesXArcadeOverlay")
	if oldOverlay then
		oldOverlay:Destroy()
	end

	local overlay = Instance.new("ScreenGui")
	overlay.Name = "AntillesXArcadeOverlay"
	overlay.IgnoreGuiInset = true
	overlay.ResetOnSpawn = false
	overlay.DisplayOrder = 100
	overlay.Parent = playerGui

	local scoreLabel = Instance.new("TextLabel")
	scoreLabel.Name = "ScoreLabel"
	scoreLabel.AnchorPoint = Vector2.new(0.5, 0)
	scoreLabel.Position = UDim2.fromScale(0.5, 0.04)
	scoreLabel.Size = UDim2.fromOffset(320, 56)
	scoreLabel.BackgroundColor3 = Color3.fromRGB(4, 13, 37)
	scoreLabel.BackgroundTransparency = 0.15
	scoreLabel.BorderColor3 = Color3.fromRGB(72, 241, 255)
	scoreLabel.BorderSizePixel = 2
	scoreLabel.Font = Enum.Font.GothamBlack
	scoreLabel.TextColor3 = Color3.fromRGB(235, 255, 255)
	scoreLabel.TextScaled = true
	scoreLabel.Text = "SCORE  0"
	scoreLabel.Parent = overlay

	local exitHint = Instance.new("TextLabel")
	exitHint.Name = "ExitHint"
	exitHint.AnchorPoint = Vector2.new(0.5, 1)
	exitHint.Position = UDim2.fromScale(0.5, 0.96)
	exitHint.Size = UDim2.fromOffset(260, 30)
	exitHint.BackgroundTransparency = 1
	exitHint.Font = Enum.Font.GothamMedium
	exitHint.TextColor3 = Color3.fromRGB(201, 225, 255)
	exitHint.TextScaled = true
	exitHint.Text = "Press Q to leave arcade"
	exitHint.Parent = overlay

	return overlay
end

function ArcadeEngine.new(configuration: ArcadeConfiguration): ArcadeEngine
	assert(RunService:IsClient(), "ArcadeEngine must be constructed from a LocalScript")
	assert(type(configuration.gameName) == "string" and #configuration.gameName > 0, "gameName is required")

	return setmetatable({
		_configuration = configuration,
		_camera = workspace.CurrentCamera,
		_previousCameraType = nil :: Enum.CameraType?,
		_previousCameraSubject = nil :: Instance?,
		_previousCameraCFrame = nil :: CFrame?,
		_previousFieldOfView = nil :: number?,
		_overlay = nil :: ScreenGui?,
		_score = 0,
		_active = false,
		_inputConnection = nil :: RBXScriptConnection?,
	}, ArcadeEngine) :: any
end

function ArcadeEngine:isActive(): boolean
	return self._active
end

function ArcadeEngine:_refreshScore()
	if self._overlay then
		local scoreLabel = self._overlay:FindFirstChild("ScoreLabel")
		if scoreLabel and scoreLabel:IsA("TextLabel") then
			scoreLabel.Text = "SCORE  " .. tostring(self._score)
		end
	end
	if self._configuration.onScoreChanged then
		self._configuration.onScoreChanged(self._score)
	end
end

function ArcadeEngine:enter()
	if self._active then
		return
	end

	local camera = workspace.CurrentCamera
	if not camera then
		error("No active workspace camera is available", 2)
	end

	self._camera = camera
	self._previousCameraType = camera.CameraType
	self._previousCameraSubject = camera.CameraSubject
	self._previousCameraCFrame = camera.CFrame
	self._previousFieldOfView = camera.FieldOfView

	camera.CameraType = Enum.CameraType.Scriptable
	camera.CFrame = self._configuration.cameraCFrame
	camera.FieldOfView = self._configuration.cameraFieldOfView or 70
	self._overlay = makeOverlay()
	self._active = true
	self:_refreshScore()

	self._inputConnection = UserInputService.InputBegan:Connect(function(input, processed)
		if processed or not self._active then
			return
		end
		if input.KeyCode == Enum.KeyCode.Q then
			self:exit()
		end
	end)
end

function ArcadeEngine:exit()
	if not self._active then
		return
	end

	self._active = false
	if self._inputConnection then
		self._inputConnection:Disconnect()
		self._inputConnection = nil
	end
	if self._overlay then
		self._overlay:Destroy()
		self._overlay = nil
	end

	local camera = self._camera
	if camera then
		camera.CameraType = self._previousCameraType or Enum.CameraType.Custom
		camera.CameraSubject = self._previousCameraSubject
		if self._previousCameraCFrame then
			camera.CFrame = self._previousCameraCFrame
		end
		camera.FieldOfView = self._previousFieldOfView or 70
	end
	if self._configuration.onExit then
		self._configuration.onExit()
	end
end

function ArcadeEngine:setScore(score: number)
	assert(type(score) == "number" and score == score and score >= 0, "score must be a non-negative number")
	self._score = math.floor(score)
	self:_refreshScore()
end

function ArcadeEngine:addScore(amount: number)
	assert(type(amount) == "number" and amount == amount, "score amount must be a number")
	self:setScore(math.max(0, self._score + amount))
end

function ArcadeEngine:submitScore()
	if not self._active then
		warn("ArcadeEngine ignored score submission outside an active arcade session")
		return
	end
	getSubmitRemote():FireServer({
		gameName = self._configuration.gameName,
		score = self._score,
	})
end

return ArcadeEngine
