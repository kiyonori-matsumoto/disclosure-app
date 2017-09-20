import { BrowserModule } from "@angular/platform-browser";
import { NgModule } from "@angular/core";
import { TwitterTimePipe } from "./twitter-time";

@NgModule({
  imports: [BrowserModule],
  declarations: [TwitterTimePipe],
  exports: [TwitterTimePipe],
})
export class TwitterTimeModule { }
