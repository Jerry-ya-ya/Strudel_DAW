import { TestBed } from '@angular/core/testing';
import { StrudelEngineService } from './strudel-engine.service';
import { VolumeControlComponent } from './volume-control.component';

describe('VolumeControlComponent', () => {
  it('adjusts volume with buttons and stops at the limits', async () => {
    await TestBed.configureTestingModule({ imports: [VolumeControlComponent] }).compileComponents();
    const fixture = TestBed.createComponent(VolumeControlComponent);
    const engine = TestBed.inject(StrudelEngineService);
    fixture.detectChanges();

    const [decrease, increase] = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    decrease.click();
    fixture.detectChanges();
    expect(engine.masterVolume()).toBeCloseTo(0.7);
    expect(fixture.nativeElement.querySelector('output').textContent).toContain('70%');

    for (let index = 0; index < 7; index++) decrease.click();
    fixture.detectChanges();
    expect(engine.masterVolume()).toBe(0);
    expect(decrease.disabled).toBe(true);

    for (let index = 0; index < 10; index++) increase.click();
    fixture.detectChanges();
    expect(engine.masterVolume()).toBe(1);
    expect(increase.disabled).toBe(true);
  });
});
