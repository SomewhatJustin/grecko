import { describe, expect, it } from 'vitest'
import { parseAndroidDevices, parseAndroidUiXml } from './android-store.js'

describe('parseAndroidDevices', () => {
  it('parses adb device output into structured targets', () => {
    const devices = parseAndroidDevices(`
List of devices attached
emulator-5554          device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:4
ZX1G22BQQB             unauthorized usb:1-1 transport_id:7
`)

    expect(devices).toHaveLength(2)
    expect(devices[0]).toMatchObject({
      serial: 'emulator-5554',
      state: 'device',
      isEmulator: true,
      model: 'sdk_gphone64_x86_64',
    })
    expect(devices[1]).toMatchObject({
      serial: 'ZX1G22BQQB',
      state: 'unauthorized',
      isEmulator: false,
    })
  })
})

describe('parseAndroidUiXml', () => {
  it('extracts clickable controls and editable fields from a UIAutomator dump', () => {
    const snapshot = parseAndroidUiXml(`
      <hierarchy rotation="0">
        <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.futo.notes" clickable="false" enabled="true" focusable="false" bounds="[0,0][1080,2400]">
          <node index="0" text="New" resource-id="com.futo.notes:id/new_note" class="android.widget.Button" package="com.futo.notes" clickable="true" enabled="true" focusable="true" bounds="[48,2120][336,2240]" />
          <node index="1" text="Grecko QA note" resource-id="com.futo.notes:id/title" class="android.widget.EditText" package="com.futo.notes" clickable="true" enabled="true" focusable="true" editable="true" bounds="[72,360][1008,488]" />
          <node index="2" text="Body text" resource-id="com.futo.notes:id/body" class="android.widget.EditText" package="com.futo.notes" clickable="true" enabled="true" focusable="true" editable="true" bounds="[72,520][1008,1180]" />
        </node>
      </hierarchy>
    `)

    expect(snapshot.buttons[0]).toMatchObject({
      text: 'New',
      tagName: 'button',
      resourceId: 'com.futo.notes:id/new_note',
    })
    expect(snapshot.fields).toHaveLength(2)
    expect(snapshot.fields[0]).toMatchObject({
      tagName: 'edittext',
      value: 'Grecko QA note',
      resourceId: 'com.futo.notes:id/title',
    })
    expect(snapshot.bodyTextExcerpt).toContain('New')
    expect(snapshot.bodyTextExcerpt).toContain('Grecko QA note')
  })
})
