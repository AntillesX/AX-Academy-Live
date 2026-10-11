--!strict
-- LocalScript: holographic wallet and course-status HUD.
-- Server systems update the replicated Player attributes: XPBalance, AntXBalance, CourseStatus.

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer

local function formatNumber(value: number): string
	local rounded = math.floor(value + 0.5)
	local formatted = tostring(rounded)
	while true do
		local replaced, count = string.gsub(formatted, "^(-?%d+)(%d%d%d)", "%1,%2")
		formatted = replaced
		if count == 0 then
			break
		end
	end
	return formatted
end

local function makeTextLabel(name: string, size: UDim2, position: UDim2, font: Enum.Font): TextLabel
	local label = Instance.new("TextLabel")
	label.Name = name
	label.Size = size
	label.Position = position
	label.BackgroundTransparency = 1
	label.Font = font
	label.TextColor3 = Color3.fromRGB(124, 255, 255)
	label.TextStrokeColor3 = Color3.fromRGB(0, 28, 54)
	label.TextStrokeTransparency = 0.2
	label.TextScaled = true
	label.TextXAlignment = Enum.TextXAlignment.Left
	return label
end

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "AntillesXSpatialUI"
screenGui.ResetOnSpawn = false
screenGui.IgnoreGuiInset = true
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
screenGui.Parent = player:WaitForChild("PlayerGui")

local hud = Instance.new("Frame")
hud.Name = "WalletHUD"
hud.AnchorPoint = Vector2.new(0, 1)
hud.Position = UDim2.fromScale(0.025, 0.955)
hud.Size = UDim2.fromOffset(330, 120)
hud.BackgroundColor3 = Color3.fromRGB(2, 17, 42)
hud.BackgroundTransparency = 0.18
hud.BorderColor3 = Color3.fromRGB(66, 238, 255)
hud.BorderSizePixel = 2
hud.Parent = screenGui

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 12)
corner.Parent = hud

local gradient = Instance.new("UIGradient")
gradient.Color = ColorSequence.new({
	ColorSequenceKeypoint.new(0, Color3.fromRGB(4, 31, 72)),
	ColorSequenceKeypoint.new(1, Color3.fromRGB(18, 7, 58)),
})
gradient.Rotation = 24
gradient.Parent = hud

local title = makeTextLabel("Title", UDim2.fromOffset(300, 26), UDim2.fromOffset(16, 8), Enum.Font.GothamBold)
title.Text = "ANTILLESX  //  LIVE STATUS"
title.TextSize = 13
title.Parent = hud

local xpLabel = makeTextLabel("XP", UDim2.fromOffset(300, 28), UDim2.fromOffset(16, 38), Enum.Font.GothamSemibold)
xpLabel.Parent = hud

local antXLabel = makeTextLabel("AntX", UDim2.fromOffset(300, 28), UDim2.fromOffset(16, 64), Enum.Font.GothamSemibold)
antXLabel.TextColor3 = Color3.fromRGB(255, 211, 77)
antXLabel.Parent = hud

local courseLabel = makeTextLabel("Course", UDim2.fromOffset(300, 24), UDim2.fromOffset(16, 92), Enum.Font.Gotham)
courseLabel.TextColor3 = Color3.fromRGB(210, 227, 255)
courseLabel.Parent = hud

local hologram: BillboardGui? = nil
local hologramXp: TextLabel? = nil
local hologramAntX: TextLabel? = nil

local function createHologram(character: Model)
	local adornee = character:FindFirstChild("Head") or character:WaitForChild("HumanoidRootPart", 10)
	if not adornee or not adornee:IsA("BasePart") then
		return
	end

	if hologram then
		hologram:Destroy()
	end

	local billboard = Instance.new("BillboardGui")
	billboard.Name = "AntillesXHolographicWallet"
	billboard.Adornee = adornee
	billboard.AlwaysOnTop = true
	billboard.LightInfluence = 0
	billboard.MaxDistance = 65
	billboard.Size = UDim2.fromOffset(230, 65)
	billboard.StudsOffset = Vector3.new(0, 3.2, 0)
	billboard.Parent = character

	local panel = Instance.new("Frame")
	panel.Size = UDim2.fromScale(1, 1)
	panel.BackgroundColor3 = Color3.fromRGB(3, 22, 50)
	panel.BackgroundTransparency = 0.23
	panel.BorderColor3 = Color3.fromRGB(80, 248, 255)
	panel.BorderSizePixel = 1
	panel.Parent = billboard

	local panelCorner = Instance.new("UICorner")
	panelCorner.CornerRadius = UDim.new(0, 8)
	panelCorner.Parent = panel

	local holoTitle = makeTextLabel("HologramTitle", UDim2.new(1, -16, 0, 18), UDim2.fromOffset(8, 4), Enum.Font.GothamBold)
	holoTitle.Text = "ANTILLESX WALLET"
	holoTitle.TextSize = 10
	holoTitle.Parent = panel

	hologramXp = makeTextLabel("HologramXP", UDim2.new(1, -16, 0, 19), UDim2.fromOffset(8, 22), Enum.Font.GothamSemibold)
	hologramXp.TextSize = 13
	hologramXp.Parent = panel

	hologramAntX = makeTextLabel("HologramAntX", UDim2.new(1, -16, 0, 19), UDim2.fromOffset(8, 41), Enum.Font.GothamSemibold)
	hologramAntX.TextColor3 = Color3.fromRGB(255, 211, 77)
	hologramAntX.TextSize = 13
	hologramAntX.Parent = panel

	hologram = billboard
end

local function updateWallet()
	local xpBalance = tonumber(player:GetAttribute("XPBalance")) or 0
	local antXBalance = tonumber(player:GetAttribute("AntXBalance")) or 0
	xpLabel.Text = "XP      " .. formatNumber(xpBalance)
	antXLabel.Text = "AntX    " .. formatNumber(antXBalance)
	if hologramXp then
		hologramXp.Text = "XP  " .. formatNumber(xpBalance)
	end
	if hologramAntX then
		hologramAntX.Text = "AntX  " .. formatNumber(antXBalance)
	end

	local pulse = TweenService:Create(hud, TweenInfo.new(0.16, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		BackgroundTransparency = 0.04,
	})
	pulse:Play()
	pulse.Completed:Once(function()
		TweenService:Create(hud, TweenInfo.new(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			BackgroundTransparency = 0.18,
		}):Play()
	end)
end

local function updateCourseStatus()
	local status = tostring(player:GetAttribute("CourseStatus") or "No active course")
	courseLabel.Text = "COURSE  " .. string.upper(status)
end

player:GetAttributeChangedSignal("XPBalance"):Connect(updateWallet)
player:GetAttributeChangedSignal("AntXBalance"):Connect(updateWallet)
player:GetAttributeChangedSignal("CourseStatus"):Connect(updateCourseStatus)
player.CharacterAdded:Connect(createHologram)

if player.Character then
	task.spawn(createHologram, player.Character)
end
updateWallet()
updateCourseStatus()
