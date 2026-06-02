package io.github.vakho10;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HelloController.class)
class HelloControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void helloGreetsFromJava() throws Exception {
        mockMvc.perform(get("/api/hello"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("Hello from Java")));
    }

    @Test
    void greetUsesProvidedName() throws Exception {
        mockMvc.perform(post("/api/greet")
                        .contentType("application/json")
                        .content("{\"name\":\"Vakho\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("Hello, Vakho!")));
    }

    @Test
    void greetFallsBackToWorld() throws Exception {
        mockMvc.perform(post("/api/greet")
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("Hello, World!")));
    }
}
