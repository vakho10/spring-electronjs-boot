package io.github.vakho10;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class HelloController {

    @GetMapping("/api/hello")
    public Map<String, String> hello() {
        return Map.of("message", "Hello from Java " + Runtime.version());
    }

    @PostMapping("/api/greet")
    public Map<String, String> greet(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "World");
        if (name.isBlank()) {
            name = "World";
        }
        return Map.of("message", "Hello, " + name + "! 👋");
    }
}
