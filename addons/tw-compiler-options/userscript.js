export default async function ({ addon, global, console }) {
  const vm = addon.tab.traps.vm;
  vm.setCompilerOptions({
    enabled: false
  });
}
