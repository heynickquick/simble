# Nick's Phone Runbook

**What is this?** Three phones that send text messages for Nick's business. They just need to stay plugged in and on WiFi.

## What you need to do

### One-time setup (15 min)

1. Find a spot in your house with good WiFi signal. A shelf or table near your router is perfect.
2. Plug the small white UPS box into the wall outlet.
3. Plug the black power strip into the UPS.
4. Plug the small Raspberry Pi (looks like a credit-card-sized green board) into the power strip.
5. Plug the Anker USB hub into the power strip.
6. Plug each of the 3 phones into the USB hub with its own cable.
7. **Leave the phones ON, plugged in, screen-off** (the dark screen is fine — they are still working).
8. Wait 5 minutes. The Pi will beep once when it is ready.

That is it.

### Daily

Nothing. Just leave them alone.

### If something beeps

- **One beep every few seconds from the UPS** = power is out, UPS is on battery. Normal. Phones and Pi will keep running for about 30 minutes. Once power comes back, the beeping stops.
- **Long solid beep from the UPS** = UPS battery is critically low. Plug UPS into the wall immediately.

### If Nick asks you to do something

He will tell you. Probably just "reboot the phones" — that means hold the power button on the phone for 5 seconds, wait 10 seconds, hold power again.

## What NOT to do

- Do not unplug the phones.
- Do not reset the phones.
- Do not open the textbee app on the phones (just let it run in the background).
- Do not move the Pi.

## What to do if WiFi goes out

Nothing — phones will reconnect automatically when WiFi comes back. If a phone stays off for more than an hour, text Nick.

## Contact

- Nick: +1-XXX-XXX-XXXX (WhatsApp preferred)
- For URGENT issues only (Pi smoking, sparks): call 911 first, then Nick
