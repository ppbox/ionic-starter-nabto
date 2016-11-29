import { Component } from '@angular/core';
import { NavController, NavParams } from 'ionic-angular';
import { ToastController } from 'ionic-angular';
import { NabtoDevice } from '../../app/device.class';
import { NabtoService } from '../../app/nabto.service';
import { LoadingController } from 'ionic-angular';

declare var NabtoError;

@Component({
  selector: 'page-vendor-heating',
  templateUrl: 'vendor-heating.html'
})
export class VendorHeatingPage {
  
  device: NabtoDevice;
  busy: boolean;
  activated: boolean;
  offline: boolean;
  temperature: number;
  mode: string;
  roomTemperature: number;
  maxTemp: number;
  minTemp: number;
  timer: any;
  spinner: any;
  unavailableStatus: string;

  constructor(public navCtrl: NavController,
              private nabtoService: NabtoService,
              public toastCtrl: ToastController,
              public loadingCtrl: LoadingController,
              public navParams: NavParams) {
    this.device = navParams.get('device');
    this.temperature = undefined;
    this.activated = false;
    this.offline = true;
    this.mode = undefined;
    this.maxTemp = 30;
    this.minTemp = 16;
    this.timer = undefined;
    this.busy = false;
 	this.nabtoService.prepareConnect().
	  then().catch(error => {
        this.busyEnd();
        this.handleError(error);
      });
  }

  ionViewDidLoad() {
    this.refresh();
  }

  refresh() {
    this.busyBegin();
    this.nabtoService.invokeRpc(this.device, "heatpump_get_full_state.json").
      then((state: any) => {
        this.busyEnd();
        console.log(`Got new heatpump state: ${JSON.stringify(state)}`);
        this.activated = state.activated;
        this.offline = false;
        this.mode = this.mapDeviceMode(state.mode);
        this.temperature = this.mapDeviceTemp(state.target_temperature);
        this.roomTemperature = state.room_temperature;
        if (!this.activated) {
          this.unavailableStatus = "Powered off";
        }
        console.log(`offline=${this.offline}, activated=${this.activated}`);
      }).catch(error => {
        this.busyEnd();
        this.handleError(error);
      });
  }

  activationToggled() {
    console.log("Activation toggled - state is now " + this.activated);
    this.busyBegin();
    this.nabtoService.invokeRpc(this.device, "heatpump_set_activation_state.json",
                                { "activated": this.activated ? 1 : 0 }).
      then((state: any) => {
        this.busyEnd();
        this.activated = state.activated;
        if (!this.activated) {
          this.unavailableStatus = "Powered off";
        }
      }).catch(error => {
        this.busyEnd();
        this.handleError(error);
      });
  }

  busyBegin() {
    if (!this.busy) {
      this.busy = true;
      this.timer = setTimeout(() => this.showSpinner(), 250);
    }
  }

  busyEnd() {
    this.busy = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.spinner) {
      this.spinner.dismiss();
      this.spinner = undefined;
    }
  }
  
  tempChanged(temp) {
    console.log(`Temperature changed - value is now ${this.temperature}, event temp is ${temp}`);
    this.temperature = temp;
    this.updateTargetTemperature();
  }

  increment() {
    if (this.activated) { // we cannot disable tap events on icon in html
      if (this.temperature < this.maxTemp) {
        this.temperature++;
      }
      this.updateTargetTemperature();
    }
  }

  decrement() {
    if (this.activated) { // we cannot disable tap events on icon in html
      if (this.temperature > this.minTemp) {
        this.temperature--;
      }
      this.updateTargetTemperature();
    }
  }

  updateTargetTemperature() {
    // XXX: no spinner as long as we don't debounce and invoke device every time (it yields odd behavior)
    this.nabtoService.invokeRpc(this.device, "heatpump_set_target_temperature.json",
                                { "temperature": this.temperature }).
      then((state: any) => {
        this.temperature = state.temperature;
      }).catch(error => {
        this.handleError(error);
      });
  }

  updateMode() {
    this.busyBegin();
    this.nabtoService.invokeRpc(this.device, "heatpump_set_mode.json",
                                { "mode": this.mapToDeviceMode(this.mode) }).
      then((state: any) => {
        this.busyEnd();
        this.mode = this.mapDeviceMode(state.mode);
      }).catch(error => {
        this.busyEnd();
        this.handleError(error);
      });
  }
  
  mapDeviceMode(mode: number) {
    switch (mode) {
    case 0: return "cool";
    case 1: return "heat";
    case 2: return "circulate";
    case 3: return "dehumidify";
    default: return "unknown";
    }
  }

  mapToDeviceMode(mode: string) {
    switch (mode) {
    case "cool": return 0;
    case "heat": return 1;
    case "circulate": return 2;
    case "dehumidify": return 3;
    default: return -1;
    }
  }

  mapDeviceTemp(tempFromDevice: number) {
    if (tempFromDevice < this.minTemp) {
      return this.minTemp;
    } else if (tempFromDevice > this.maxTemp) {
      return this.maxTemp;
    } else {
      return tempFromDevice;
    }
  }

  handleError(error: any) {
    console.log(`Handling error: ${error.code}`);
    if (error.code == NabtoError.Code.API_RPC_DEVICE_OFFLINE) {
      this.unavailableStatus = "Device offline";
      this.offline = true;
      this.showToast(error.message, 2000);
    } else {
      this.showToast(error.message);
      console.log("ERROR invoking device: " + JSON.stringify(error));
    }
  }

  showToast(message: string, duration?: number) {
    var opts = <any>{
      message: message,
      showCloseButton: true,
      closeButtonText: 'Ok'
    };
    if (duration) {
      opts.duration = duration;
    }
    let toast = this.toastCtrl.create(opts);
    toast.present();
  }
  
  showSpinner() {
    this.spinner = this.loadingCtrl.create({
      content: "Invoking device...",
    });
    this.spinner.present();
  }

  available() {
    return this.activated && !this.offline;
  }

  unavailable() {
    return !this.activated || this.offline;
  }
 
}
